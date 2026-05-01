
"""
AgroMind Regret AI+ — ML Service v3.0
Features: LeafAI expertise, MobileNetV2 disease detection, leaf ID, symptom analysis,
          financial loss projection, Regret AI behavioral engine,
          ML operations: Classification, Regression, Clustering, Anomaly Detection.
"""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, numpy as np, os, json, logging, io
from PIL import Image
from pathlib import Path

# LeafAI Integration
try:
    from leaf_ai_service import LeafAIService
    LEAFAI_AVAILABLE = True
except ImportError:
    LEAFAI_AVAILABLE = False
    print("⚠️ LeafAI service not available")

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AgroMind ML Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DEFAULT_CLASS_LABELS = [
    "Apple___Apple_scab","Apple___Black_rot","Apple___Cedar_apple_rust","Apple___healthy",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew","Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot_Gray_leaf_spot","Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight","Corn_(maize)___healthy",
    "Grape___Black_rot","Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)","Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot","Peach___healthy",
    "Pepper,_bell___Bacterial_spot","Pepper,_bell___healthy",
    "Potato___Early_blight","Potato___Late_blight","Potato___healthy",
    "Raspberry___healthy","Soybean___healthy","Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch","Strawberry___healthy",
    "Tomato___Bacterial_spot","Tomato___Early_blight","Tomato___Late_blight",
    "Tomato___Leaf_Mold","Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites_Two-spotted_spider_mite","Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus","Tomato___Tomato_mosaic_virus",
    "Tomato___healthy"
]

CLASS_LABELS = []
CLASS_INDEX_PATH = Path("models/class_indices.json")


def normalize_label(label: str) -> str:
    return label.replace(" ", "_")


def load_class_labels() -> None:
    global CLASS_LABELS

    if CLASS_INDEX_PATH.exists():
        try:
            with open(CLASS_INDEX_PATH, "r", encoding="utf-8") as f:
                class_indices = json.load(f)

            if isinstance(class_indices, dict) and class_indices:
                max_index = max(int(v) for v in class_indices.values())
                index_to_label = [None] * (max_index + 1)
                for label, index in class_indices.items():
                    idx = int(index)
                    if idx < 0 or idx > max_index:
                        raise ValueError(f"Invalid class index: {idx}")
                    index_to_label[idx] = normalize_label(str(label))

                if any(label is None for label in index_to_label):
                    raise ValueError("class_indices.json has missing indices")

                CLASS_LABELS = index_to_label
                logger.info(f"Loaded {len(CLASS_LABELS)} class labels from class_indices.json")
                return
        except Exception as e:
            logger.warning(f"Failed to parse class_indices.json: {e}; using built-in labels")

    CLASS_LABELS = [normalize_label(label) for label in DEFAULT_CLASS_LABELS]
    logger.info(f"Using {len(CLASS_LABELS)} built-in class labels")

DISEASE_DB_PATH = Path(os.getenv("DISEASE_DB_PATH", "data/disease_db.json"))
DISEASE_DB = {}

def load_disease_db():
    global DISEASE_DB
    try:
        if DISEASE_DB_PATH.exists():
            DISEASE_DB = json.loads(DISEASE_DB_PATH.read_text(encoding="utf-8"))
            if not isinstance(DISEASE_DB, dict):
                raise ValueError('disease_db.json must be a JSON object')
            logger.info(f"Loaded {len(DISEASE_DB)} disease profiles from {DISEASE_DB_PATH}")
            return
        raise FileNotFoundError(f"Disease DB not found at {DISEASE_DB_PATH}")
    except Exception as e:
        logger.error(f"Failed to load disease DB: {e}")
        DISEASE_DB = {}
DEFAULT_INFO = {"common_name":"Unknown Condition","scientific_name":"Unknown pathogen","plant":"Unknown","symptoms":["Abnormal leaf coloration detected","Further examination recommended"],"spread":"Unknown — consult agricultural extension officer","severity":"info","loss_per_acre_inr":5000,"urgency_days":14,"treatment":"Consult a local agricultural expert for precise diagnosis","prevention":"Regular crop monitoring; proper agronomic practices","regret_message":"Unidentified condition detected. Consult an expert to prevent potential losses."}

model = None
IMG_SIZE = (224, 224)
leaf_ai = None  # LeafAI Service instance

def load_model():
    global model
    mp = Path("models/plant_disease_model.h5")
    if not mp.exists():
        logger.warning("Model not found at models/plant_disease_model.h5")
        return
    try:
        import tensorflow as tf
        model = tf.keras.models.load_model(str(mp))
        logger.info(f"✅ Model loaded: {model.count_params():,} parameters")
    except Exception as e:
        logger.error(f"Model load failed: {e}")

def load_leafai():
    """Initialize LeafAI service with disease database"""
    global leaf_ai, DISEASE_DB
    try:
        leaf_ai = LeafAIService(disease_db=DISEASE_DB)
        logger.info(f"✅ LeafAI service initialized - KB has {leaf_ai.kb.kb.get('kb_path', 'unknown')} records")
    except Exception as e:
        logger.error(f"LeafAI initialization failed: {e}")
        leaf_ai = None

def preprocess(img_bytes: bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB").resize(IMG_SIZE, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)

def get_info(label: str) -> dict:
    info = DISEASE_DB.get(label, DEFAULT_INFO).copy()
    if label not in DISEASE_DB:
        parts = label.split("___")
        info["plant"] = parts[0].replace("_", " ")
        info["common_name"] = parts[1].replace("_", " ") if len(parts) > 1 else "Unknown"
        if "healthy" in label.lower():
            info["severity"] = "healthy"
            info["loss_per_acre_inr"] = 0
    return info

def regret_score(severity: str, loss: int, days: int, conf: float) -> dict:
    if severity == "healthy":
        return {"score": 0, "level": "safe", "urgency": "none", "daily_loss_inr": 0, "weekly_loss_inr": 0, "monthly_loss_inr": 0}
    daily = loss / max(days, 1)
    sev_w = {"critical": 40, "warning": 25, "info": 10}.get(severity, 10)
    loss_w = min(35, loss / 1500)
    conf_w = (conf / 100) * 20
    urg_w = max(0, 12 - days)
    score = min(100, int(sev_w + loss_w + conf_w + urg_w))
    if score >= 70: level, urgency = "critical", "Act within 24 hours"
    elif score >= 45: level, urgency = "high", f"Act within {days} days"
    elif score >= 20: level, urgency = "medium", f"Monitor for {days} days"
    else: level, urgency = "low", "Monitor regularly"
    return {"score": score, "level": level, "urgency": urgency,
            "daily_loss_inr": round(daily), "weekly_loss_inr": round(daily * 7), "monthly_loss_inr": round(daily * 30)}

def build_response(label, conf, info, rs, source, top5):
    return {
        "disease": info["common_name"], "plant": info["plant"], "class_label": label,
        "confidence": round(conf, 1), "is_healthy": "healthy" in label.lower(), "source": source,
        "disease_info": {
            "scientific_name": info["scientific_name"], "symptoms": info["symptoms"],
            "spread_mechanism": info["spread"], "treatment": info["treatment"], "prevention": info["prevention"],
        },
        "severity": info["severity"], "loss_per_acre_inr": info["loss_per_acre_inr"],
        "urgency_days": info["urgency_days"],
        "regret_ai": {"message": info["regret_message"], **rs},
        "top5_predictions": top5,
        "behavioral_triggers": {
            "loss_framing": f"Every day of delay costs ₹{rs.get('daily_loss_inr', 0):,}",
            "urgency": rs.get("urgency", "Monitor regularly"),
            "treatment_cost_estimate_inr": round(info["loss_per_acre_inr"] * 0.08),
            "roi": f"Spend ₹{round(info['loss_per_acre_inr'] * 0.08):,} to save ₹{info['loss_per_acre_inr']:,}",
            "social_proof": "Farmers who act within 24h save 85% of preventable losses",
        }
    }

@app.on_event("startup")
async def startup():
    load_class_labels()
    load_disease_db()
    load_model()
    if LEAFAI_AVAILABLE:
        load_leafai()
        logger.info("🧠 LeafAI Expert System Ready - Autonomous Leaf Intelligence Activated")

@app.get("/")
def root(): return {"service": "AgroMind ML", "version": "3.0.0", "model_loaded": model is not None, "leafai_available": LEAFAI_AVAILABLE and leaf_ai is not None, "classes": len(CLASS_LABELS), "diseases_in_db": len(DISEASE_DB)}

@app.get("/health")
def health(): return {"status": "ok", "model_loaded": model is not None, "leafai_status": "ready" if (LEAFAI_AVAILABLE and leaf_ai) else "unavailable"}

@app.get("/diseases")
def list_diseases():
    return {"total": len(DISEASE_DB), "diseases": {k: {"common_name": v["common_name"], "plant": v["plant"], "severity": v["severity"]} for k, v in DISEASE_DB.items()}}

@app.get("/diseases/{label:path}")
def get_disease(label: str):
    info = DISEASE_DB.get(label)
    if not info: raise HTTPException(404, f"Disease '{label}' not in database")
    return info

# ════════════════════════════════════════════════════════════════════════════════
# 🧠 LEAFAI ENDPOINTS — Expert Leaf Identification & ML Operations
# ════════════════════════════════════════════════════════════════════════════════

@app.post("/leafai/identify")
async def leafai_identify(image: UploadFile = File(...), override_class: str = None):
    """
    🌿 LeafAI Identification with Permanent Knowledge Storage
    
    Returns:
    - Leaf ID (auto-generated UUID)
    - Plant name + Scientific name + Family
    - Confidence score + Interpretation
    - Disease info (if diseased)
    - TOP 5 similarity matches
    - Anomaly detection alert
    - All ML operations performed
    """
    if not LEAFAI_AVAILABLE or not leaf_ai:
        raise HTTPException(503, "LeafAI service not available")
    
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    
    img_bytes = await image.read()
    if len(img_bytes) > 15 * 1024 * 1024:
        raise HTTPException(400, "Image too large (max 15MB)")
    
    if model is None:
        raise HTTPException(503, "Model is not loaded")
    
    try:
        import tensorflow as tf
        arr = preprocess(img_bytes)
        preds = model.predict(arr, verbose=0)[0]
        idx = int(np.argmax(preds))
        
        if idx >= len(CLASS_LABELS):
            raise ValueError(f"Model output index {idx} outside class label range")
        
        label = CLASS_LABELS[idx]
        conf = float(preds[idx]) * 100
        
        # Get top 5 model predictions
        top5_model = [
            {"label": CLASS_LABELS[i], "confidence": round(float(preds[i]) * 100, 2)}
            for i in np.argsort(preds)[::-1][:5]
            if i < len(CLASS_LABELS)
        ]
        
        # Call LeafAI identification
        model_prediction = {
            "class_label": label,
            "confidence": conf,
            "top5": top5_model
        }
        
        result = leaf_ai.identify_leaf(
            model_predictions=model_prediction,
            img_bytes=img_bytes,
            manual_override=override_class
        )
        
        return result
        
    except Exception as e:
        logger.error(f"LeafAI identification error: {e}")
        raise HTTPException(500, f"Identification failed: {str(e)}")

@app.post("/leafai/identify/manual")
async def leafai_identify_manual(
    image: UploadFile = File(...),
    common_name: str = None,
    scientific_name: str = None,
    family: str = None,
    health_status: str = "Healthy",
    confidence: float = 95.0
):
    """
    🌿 Manual Leaf Identification with User-Provided Metadata
    Useful for expert verification or training
    """
    if not LEAFAI_AVAILABLE or not leaf_ai:
        raise HTTPException(503, "LeafAI service not available")
    
    img_bytes = await image.read() if image else None
    
    try:
        # Create manual leaf record
        kb_result = leaf_ai.kb.add_leaf(
            common_name=common_name or "Unknown",
            scientific_name=scientific_name or "Unknown",
            family=family or "Unknown",
            health_status=health_status,
            img_bytes=img_bytes,
            confidence=confidence,
            source="manual_expert"
        )
        
        return {
            "status": "success",
            "message": "Leaf manually registered in knowledge base",
            **kb_result
        }
    except Exception as e:
        raise HTTPException(500, f"Manual registration failed: {str(e)}")

@app.get("/leafai/leaf/{leaf_id}")
def leafai_get_leaf(leaf_id: str):
    """Retrieve a stored leaf record by ID"""
    if not LEAFAI_AVAILABLE or not leaf_ai:
        raise HTTPException(503, "LeafAI service not available")
    
    leaf = leaf_ai.kb.get_leaf(leaf_id)
    if not leaf:
        raise HTTPException(404, f"Leaf {leaf_id} not found")
    
    return leaf

@app.post("/leafai/regression/{leaf_id}")
def leafai_regression(leaf_id: str):
    """
    📊 REGRESSION: Predict crop yield, disease severity, days to harvest
    """
    if not LEAFAI_AVAILABLE or not leaf_ai:
        raise HTTPException(503, "LeafAI service not available")
    
    result = leaf_ai.perform_regression(leaf_id, {})
    if "error" in result:
        raise HTTPException(404, result["error"])
    
    return result

@app.get("/leafai/clustering")
def leafai_clustering(limit: int = 10):
    """
    🔀 CLUSTERING: Group similar leaves by shape, color, texture, disease patterns
    Unsupervised learning - discovers natural groupings
    """
    if not LEAFAI_AVAILABLE or not leaf_ai:
        raise HTTPException(503, "LeafAI service not available")
    
    return leaf_ai.perform_clustering(limit=limit)

@app.get("/leafai/anomalies")
def leafai_detect_anomalies():
    """
    🚨 ANOMALY DETECTION: Detect unusual leaf patterns, rare diseases, mutations
    """
    if not LEAFAI_AVAILABLE or not leaf_ai:
        raise HTTPException(503, "LeafAI service not available")
    
    return leaf_ai.detect_anomalies()

@app.get("/leafai/knowledge-base/stats")
def leafai_kb_stats():
    """📈 Get LeafAI Knowledge Base Statistics"""
    if not LEAFAI_AVAILABLE or not leaf_ai:
        raise HTTPException(503, "LeafAI service not available")
    
    return leaf_ai.get_knowledge_base_stats()

@app.get("/leafai/knowledge-base/search")
def leafai_search(plant_name: str = None, min_confidence: float = 0.0):
    """🔍 Search knowledge base by plant name"""
    if not LEAFAI_AVAILABLE or not leaf_ai:
        raise HTTPException(503, "LeafAI service not available")
    
    if not plant_name:
        raise HTTPException(400, "plant_name query parameter required")
    
    results = leaf_ai.kb.find_similar_leaves(plant_name)
    
    return {
        "search_query": plant_name,
        "total_results": len(results),
        "results": results
    }

@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    img_bytes = await image.read()
    if len(img_bytes) > 15 * 1024 * 1024: raise HTTPException(400, "Image too large (max 15MB)")
    if model is None:
        raise HTTPException(503, "Model is not loaded. Train model and restart service.")
    try:
        import tensorflow as tf
        arr = preprocess(img_bytes)
        preds = model.predict(arr, verbose=0)[0]
        idx = int(np.argmax(preds))
        if idx >= len(CLASS_LABELS):
            raise ValueError(f"Model output index {idx} outside class label range {len(CLASS_LABELS)}")
        label = CLASS_LABELS[idx]
        conf = float(preds[idx]) * 100
        top5 = [
            {"label": CLASS_LABELS[i], "confidence": round(float(preds[i]) * 100, 2)}
            for i in np.argsort(preds)[::-1][:5]
            if i < len(CLASS_LABELS)
        ]
        info = get_info(label)
        rs = regret_score(info["severity"], info["loss_per_acre_inr"], info["urgency_days"], conf)
        return build_response(label, conf, info, rs, "model", top5)
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(500, "Prediction failed")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
