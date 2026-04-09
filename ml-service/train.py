"""
AgroMind — Train MobileNetV2 on PlantVillage Dataset
Run this script once to create models/plant_disease_model.h5

Requirements:
  pip install tensorflow pillow numpy

Dataset:
  Download PlantVillage dataset from:
  https://www.kaggle.com/datasets/emmarex/plantdisease
  Extract to: data/PlantVillage/

Usage:
  python train.py
"""
import argparse
import json
import os
import sys
from pathlib import Path

os.makedirs("models", exist_ok=True)
DEFAULT_DATA_DIR_CANDIDATES = [
    Path("data/PlantVillage"),
    Path("PlantVillage/raw/color"),
    Path("../PlantVillage/raw/color"),
]
DEFAULT_MODEL_PATH = "models/plant_disease_model.h5"
DEFAULT_IMG_SIZE = (224, 224)
DEFAULT_BATCH_SIZE = 32
DEFAULT_EPOCHS = 15
DEFAULT_FINE_TUNE_EPOCHS = 5


def normalize_label(label: str) -> str:
    # Keep labels consistent with inference and disease DB keys.
    return label.replace(" ", "_")


def resolve_data_dir(cli_data_dir: str | None) -> Path | None:
    if cli_data_dir:
        candidate = Path(cli_data_dir)
        return candidate if candidate.exists() else None

    env_data_dir = os.getenv("PLANTVILLAGE_DIR")
    if env_data_dir:
        candidate = Path(env_data_dir)
        if candidate.exists():
            return candidate

    for candidate in DEFAULT_DATA_DIR_CANDIDATES:
        if candidate.exists():
            return candidate
    return None

def train(args):
    try:
        import tensorflow as tf
        from tensorflow.keras.applications import MobileNetV2
        from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
        from tensorflow.keras.models import Model
        from tensorflow.keras.preprocessing.image import ImageDataGenerator
        from tensorflow.keras.optimizers import Adam
        from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
    except ImportError:
        print("TensorFlow not installed. Run: pip install tensorflow")
        sys.exit(1)

    data_dir = resolve_data_dir(args.data_dir)
    if data_dir is None:
        searched = ", ".join(str(path) for path in DEFAULT_DATA_DIR_CANDIDATES)
        print("Dataset not found.")
        print(f"Searched: {searched}")
        print("Download from: https://www.kaggle.com/datasets/emmarex/plantdisease")
        sys.exit(1)

    print(f"Using dataset directory: {data_dir}")

    print("Loading dataset...")
    datagen = ImageDataGenerator(
        rescale=1.0/255,
        rotation_range=30,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        vertical_flip=False,
        fill_mode='nearest',
        validation_split=0.2,
    )

    train_gen = datagen.flow_from_directory(
        str(data_dir), target_size=(args.img_size, args.img_size), batch_size=args.batch_size,
        class_mode='categorical', subset='training', seed=42,
    )
    val_gen = datagen.flow_from_directory(
        str(data_dir), target_size=(args.img_size, args.img_size), batch_size=args.batch_size,
        class_mode='categorical', subset='validation', seed=42,
    )

    n_classes = len(train_gen.class_indices)
    print(f"Found {n_classes} classes, {train_gen.samples} training images")

    # Save class mapping
    normalized_class_indices = {normalize_label(label): int(idx) for label, idx in train_gen.class_indices.items()}
    if len(normalized_class_indices) != len(train_gen.class_indices):
        print("Error: label normalization produced duplicates. Adjust normalize_label() before training.")
        sys.exit(1)

    with open("models/class_indices.json", "w", encoding="utf-8") as f:
        json.dump(normalized_class_indices, f, indent=2)

    print("Building MobileNetV2 model...")
    base = MobileNetV2(input_shape=(args.img_size, args.img_size, 3), include_top=False, weights='imagenet')
    base.trainable = False  # Freeze base initially

    x = base.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(512, activation='relu')(x)
    x = Dropout(0.4)(x)
    x = Dense(256, activation='relu')(x)
    x = Dropout(0.3)(x)
    out = Dense(n_classes, activation='softmax')(x)

    model = Model(inputs=base.input, outputs=out)
    model.compile(optimizer=Adam(1e-3), loss='categorical_crossentropy', metrics=['accuracy'])

    callbacks = [
        ModelCheckpoint(args.model_path, save_best_only=True, monitor='val_accuracy', verbose=1),
        EarlyStopping(patience=5, restore_best_weights=True),
        ReduceLROnPlateau(factor=0.5, patience=3, min_lr=1e-6),
    ]

    print(f"Training for up to {args.epochs} epochs...")
    fit_kwargs = {
        "validation_data": val_gen,
        "epochs": args.epochs,
        "callbacks": callbacks,
    }
    if args.max_train_steps is not None:
        fit_kwargs["steps_per_epoch"] = args.max_train_steps
    if args.max_val_steps is not None:
        fit_kwargs["validation_steps"] = args.max_val_steps
    model.fit(train_gen, **fit_kwargs)

    if args.fine_tune_epochs > 0:
        # Fine-tune: unfreeze last 30 layers
        print("Fine-tuning...")
        base.trainable = True
        for layer in base.layers[:-30]:
            layer.trainable = False
        model.compile(optimizer=Adam(1e-5), loss='categorical_crossentropy', metrics=['accuracy'])
        ft_fit_kwargs = {
            "validation_data": val_gen,
            "epochs": args.fine_tune_epochs,
            "callbacks": callbacks,
        }
        if args.max_train_steps is not None:
            ft_fit_kwargs["steps_per_epoch"] = args.max_train_steps
        if args.max_val_steps is not None:
            ft_fit_kwargs["validation_steps"] = args.max_val_steps
        model.fit(train_gen, **ft_fit_kwargs)

    val_loss, val_acc = model.evaluate(val_gen)
    print(f"Final validation accuracy: {val_acc:.4f}")
    print(f"Model saved to {args.model_path}")


def parse_args():
    parser = argparse.ArgumentParser(description="Train MobileNetV2 on PlantVillage")
    parser.add_argument("--data-dir", default=None, help="Dataset directory containing class subfolders")
    parser.add_argument("--model-path", default=DEFAULT_MODEL_PATH, help="Output model path")
    parser.add_argument("--img-size", type=int, default=DEFAULT_IMG_SIZE[0], help="Input image size")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help="Batch size")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS, help="Initial training epochs")
    parser.add_argument("--max-train-steps", type=int, default=None, help="Limit train steps per epoch")
    parser.add_argument("--max-val-steps", type=int, default=None, help="Limit validation steps per epoch")
    parser.add_argument(
        "--fine-tune-epochs",
        type=int,
        default=DEFAULT_FINE_TUNE_EPOCHS,
        help="Fine-tuning epochs after unfreezing the last layers",
    )
    return parser.parse_args()

if __name__ == "__main__":
    train(parse_args())
