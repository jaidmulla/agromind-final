#!/usr/bin/env python3
"""
🧠 AgroMind ML Model Training Script (Runs 3 iterations)
Trains MobileNetV2 on PlantVillage dataset multiple times for progressive improvement
"""

import os
import subprocess
import sys
from pathlib import Path

def run_training(iteration: int, epochs: int = 2, fine_tune_epochs: int = 0):
    """Run a training iteration"""
    print(f"\n{'='*80}")
    print(f"🧠 TRAINING RUN {iteration}/3")
    print(f"{'='*80}")
    print(f"📊 Configuration:")
    print(f"   Epochs: {epochs}")
    print(f"   Fine-tune Epochs: {fine_tune_epochs}")
    print(f"   Training Steps: 10 (limited for speed)")
    print(f"   Validation Steps: 5")
    print(f"{'='*80}\n")
    
    # Set environment to point to dataset
    env = os.environ.copy()
    data_dir = "/Users/jaid/Documents/Hackethone/DYP Kolhapur/agromind-final/Leaf Image/new_plants/PlantVillage_Split/train"
    env['PLANTVILLAGE_DIR'] = data_dir
    
    cmd = [
        sys.executable, "train.py",
        "--data-dir", data_dir,
        "--max-train-steps", "10",
        "--max-val-steps", "5",
        "--epochs", str(epochs),
        "--fine-tune-epochs", str(fine_tune_epochs)
    ]
    
    try:
        result = subprocess.run(cmd, cwd="/Users/jaid/Documents/Hackethone/DYP Kolhapur/agromind-final/ml-service", env=env)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Training failed: {e}")
        return False

def main():
    print("\n" + "🧠 "*20)
    print("AGROMIND ML MODEL TRAINING - 3 ITERATION PROGRAM")
    print("🧠 "*20 + "\n")
    
    results = []
    
    # Training Run 1: Initial training with 2 epochs
    print("📍 Run 1: Initial Model Training")
    success = run_training(iteration=1, epochs=2, fine_tune_epochs=0)
    results.append(("Run 1: Initial Training (2 epochs)", success))
    
    if success:
        print("✅ Training Run 1 complete!")
    else:
        print("⚠️ Training Run 1 failed")
    
    # Training Run 2: Additional epochs for better convergence
    print("\n📍 Run 2: Extended Training")
    success = run_training(iteration=2, epochs=3, fine_tune_epochs=1)
    results.append(("Run 2: Extended Training (3 epochs + 1 fine-tune)", success))
    
    if success:
        print("✅ Training Run 2 complete!")
    else:
        print("⚠️ Training Run 2 failed")
    
    # Training Run 3: Fine-tuning for final optimization
    print("\n📍 Run 3: Fine-tuning & Optimization")
    success = run_training(iteration=3, epochs=2, fine_tune_epochs=2)
    results.append(("Run 3: Fine-tuning (2 epochs + 2 fine-tune)", success))
    
    if success:
        print("✅ Training Run 3 complete!")
    else:
        print("⚠️ Training Run 3 failed")
    
    # Summary
    print("\n" + "="*80)
    print("📊 TRAINING SUMMARY")
    print("="*80)
    
    for i, (desc, success) in enumerate(results, 1):
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"{i}. {desc}: {status}")
    
    print("\n" + "="*80)
    
    successful = sum(1 for _, success in results if success)
    print(f"🎯 Total Successful Runs: {successful}/3")
    
    if successful == 3:
        print("\n🎉 ALL TRAINING RUNS COMPLETE!")
        print("\n📦 Model saved to: ml-service/models/plant_disease_model.h5")
        print("📋 Class indices saved to: ml-service/models/class_indices.json")
        print("\n✨ Model is ready for inference!")
        
        # Check if model exists
        model_path = Path("/Users/jaid/Documents/Hackethone/DYP Kolhapur/agromind-final/ml-service/models/plant_disease_model.h5")
        if model_path.exists():
            print(f"\n✅ Model file verified: {model_path.stat().st_size / (1024*1024):.1f} MB")
    
    print("\n")
    return 0 if successful > 0 else 1

if __name__ == "__main__":
    sys.exit(main())
