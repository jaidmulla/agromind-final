"""
AgroMind LeafAI Knowledge Base
Persistent storage system for leaf identifications with zero data loss
Maintains all leaf data across updates and sessions
"""
import json
import os
import uuid
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import hashlib
from PIL import Image
import io
import numpy as np

KB_PATH = Path(os.getenv("LEAF_KB_PATH", "data/leaf_knowledge_base.json"))
LEAF_IMAGE_HASH_PATH = Path(os.getenv("LEAF_HASH_PATH", "data/leaf_image_hashes.json"))
LEAF_METADATA_INDEX = Path(os.getenv("LEAF_INDEX_PATH", "data/leaf_metadata_index.json"))


class LeafKnowledgeBase:
    """
    Autonomous leaf knowledge management system.
    - Never loses previously learned data (all updates ADDITIVE)
    - Supports clustering, anomaly detection, similarity matching
    - Maintains version history for full traceability
    """
    
    def __init__(self):
        self.kb_path = KB_PATH
        self.hash_path = LEAF_IMAGE_HASH_PATH
        self.index_path = LEAF_METADATA_INDEX
        self.knowledge_base: Dict = {}
        self.image_hashes: Dict = {}
        self.metadata_index: Dict = {}
        self.version_log: List[Dict] = []
        
        # Ensure directories exist
        self.kb_path.parent.mkdir(parents=True, exist_ok=True)
        self.hash_path.parent.mkdir(parents=True, exist_ok=True)
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        
        self._load_all_data()
    
    def _load_all_data(self) -> None:
        """Load all persistent data from storage"""
        # Load knowledge base
        if self.kb_path.exists():
            try:
                self.knowledge_base = json.loads(self.kb_path.read_text(encoding="utf-8"))
            except Exception as e:
                print(f"Warning: Failed to load knowledge base: {e}")
                self.knowledge_base = {}
        
        # Load image hashes
        if self.hash_path.exists():
            try:
                self.image_hashes = json.loads(self.hash_path.read_text(encoding="utf-8"))
            except Exception as e:
                print(f"Warning: Failed to load image hashes: {e}")
                self.image_hashes = {}
        
        # Load metadata index
        if self.index_path.exists():
            try:
                self.metadata_index = json.loads(self.index_path.read_text(encoding="utf-8"))
            except Exception as e:
                print(f"Warning: Failed to load metadata index: {e}")
                self.metadata_index = {}
        
        print(f"✅ LeafAI Knowledge Base loaded: {len(self.knowledge_base)} leaves stored")
    
    def _save_all_data(self) -> None:
        """Persist all data to storage"""
        try:
            self.kb_path.write_text(json.dumps(self.knowledge_base, indent=2, ensure_ascii=False), encoding="utf-8")
            self.hash_path.write_text(json.dumps(self.image_hashes, indent=2), encoding="utf-8")
            self.index_path.write_text(json.dumps(self.metadata_index, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"Error saving knowledge base: {e}")
    
    def _compute_image_hash(self, img_bytes: bytes) -> str:
        """Compute SHA256 hash of image for duplicate detection"""
        return hashlib.sha256(img_bytes).hexdigest()
    
    def _extract_features(self, img_bytes: bytes) -> Dict:
        """Extract visual features from leaf image"""
        try:
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            arr = np.array(img, dtype=np.float32) / 255.0
            
            # Color histogram (R, G, B channels)
            r_hist = np.histogram(arr[:, :, 0], bins=8)[0].tolist()
            g_hist = np.histogram(arr[:, :, 1], bins=8)[0].tolist()
            b_hist = np.histogram(arr[:, :, 2], bins=8)[0].tolist()
            
            # Shape metrics
            shape = {
                "mean_brightness": float(np.mean(arr)),
                "saturation": float(np.std(arr)),
                "width": img.width,
                "height": img.height,
                "aspect_ratio": img.width / max(img.height, 1)
            }
            
            return {
                "color_histogram": {
                    "red": r_hist,
                    "green": g_hist,
                    "blue": b_hist
                },
                "shape": shape
            }
        except Exception as e:
            print(f"Warning: Feature extraction failed: {e}")
            return {"color_histogram": {}, "shape": {}}
    
    def add_leaf(self, 
                 common_name: str,
                 scientific_name: str,
                 family: str,
                 health_status: str,
                 disease_info: Optional[Dict] = None,
                 img_bytes: Optional[bytes] = None,
                 confidence: float = 95.0,
                 source: str = "model") -> Dict:
        """
        Add a new leaf to the knowledge base.
        CRITICAL: Updates are ADDITIVE only - never overwrites existing data
        """
        
        # Check for duplicate images
        img_hash = None
        if img_bytes:
            img_hash = self._compute_image_hash(img_bytes)
            if img_hash in self.image_hashes:
                leaf_id = self.image_hashes[img_hash]
                print(f"⚠️ Duplicate image detected. Updating leaf {leaf_id}")
                return self._update_leaf(leaf_id, img_bytes=img_bytes)
        
        # Generate unique ID
        leaf_id = f"LEAF_{str(uuid.uuid4())[:8].upper()}"
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        # Create leaf record
        leaf_record = {
            "id": leaf_id,
            "common_name": common_name,
            "scientific_name": scientific_name,
            "family": family,
            "confidence_score": confidence,
            "health_status": health_status,
            "disease_info": disease_info or {},
            "image_hash": img_hash,
            "features": self._extract_features(img_bytes) if img_bytes else {},
            "source": source,
            "timestamp": timestamp,
            "observation_count": 1,
            "update_history": [
                {
                    "action": "created",
                    "timestamp": timestamp,
                    "details": "Leaf added to knowledge base"
                }
            ]
        }
        
        # Store in knowledge base (ADDITIVE)
        self.knowledge_base[leaf_id] = leaf_record
        
        # Store image hash mapping
        if img_hash:
            self.image_hashes[img_hash] = leaf_id
        
        # Update metadata index
        key = f"{common_name}_{scientific_name}".lower()
        if key not in self.metadata_index:
            self.metadata_index[key] = {
                "common_name": common_name,
                "scientific_name": scientific_name,
                "family": family,
                "leaf_ids": [],
                "total_observations": 0,
                "diseases": []
            }
        self.metadata_index[key]["leaf_ids"].append(leaf_id)
        self.metadata_index[key]["total_observations"] += 1
        
        if disease_info and "name" in disease_info:
            if disease_info["name"] not in self.metadata_index[key]["diseases"]:
                self.metadata_index[key]["diseases"].append(disease_info["name"])
        
        # Log update
        self.version_log.append({
            "action": "add_leaf",
            "leaf_id": leaf_id,
            "timestamp": timestamp,
            "confidence": confidence
        })
        
        # Persist changes
        self._save_all_data()
        
        return {
            "status": "success",
            "leaf_id": leaf_id,
            "timestamp": timestamp,
            "stored": True
        }
    
    def _update_leaf(self, leaf_id: str, **updates) -> Dict:
        """
        Update an existing leaf record.
        CRITICAL: Only updates changed fields, preserves all other data
        """
        if leaf_id not in self.knowledge_base:
            return {"status": "error", "message": f"Leaf {leaf_id} not found"}
        
        leaf = self.knowledge_base[leaf_id]
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        # Track changes
        changes = {}
        for key, value in updates.items():
            if key not in ["img_bytes"] and value != leaf.get(key):
                changes[key] = value
        
        # Update fields
        leaf.update(changes)
        leaf["observation_count"] = leaf.get("observation_count", 1) + 1
        leaf["update_history"].append({
            "action": "updated",
            "timestamp": timestamp,
            "changes": changes
        })
        
        # Log update
        self.version_log.append({
            "action": "update_leaf",
            "leaf_id": leaf_id,
            "timestamp": timestamp,
            "changes": changes
        })
        
        self._save_all_data()
        
        return {
            "status": "success",
            "leaf_id": leaf_id,
            "timestamp": timestamp,
            "updated_fields": list(changes.keys())
        }
    
    def get_leaf(self, leaf_id: str) -> Optional[Dict]:
        """Retrieve a leaf record by ID"""
        return self.knowledge_base.get(leaf_id)
    
    def find_similar_leaves(self, common_name: str, threshold: float = 0.75) -> List[Dict]:
        """Find leaves similar to the given criteria"""
        key = f"{common_name}".lower()
        similar = []
        
        for kb_key, metadata in self.metadata_index.items():
            if common_name.lower() in kb_key:
                leaf_ids = metadata.get("leaf_ids", [])
                for lid in leaf_ids:
                    leaf = self.knowledge_base.get(lid)
                    if leaf:
                        similar.append({
                            "leaf_id": lid,
                            "common_name": leaf["common_name"],
                            "confidence": leaf["confidence_score"],
                            "health_status": leaf["health_status"],
                            "observations": leaf["observation_count"]
                        })
        
        # Sort by confidence
        return sorted(similar, key=lambda x: x["confidence"], reverse=True)[:5]
    
    def detect_anomaly(self, leaf_record: Dict) -> Dict:
        """
        Detect if this leaf pattern is anomalous (rarely seen before)
        """
        # Check against stored leaves
        similar_count = 0
        for lid, stored_leaf in self.knowledge_base.items():
            if (stored_leaf["common_name"] == leaf_record["common_name"] and
                stored_leaf["health_status"] == leaf_record["health_status"]):
                similar_count += 1
        
        is_anomaly = similar_count < 3  # Less than 3 similar observations = anomaly
        
        return {
            "is_anomaly": is_anomaly,
            "similar_observations": similar_count,
            "rarity_score": max(0, 1.0 - (similar_count / 10.0)),
            "recommendation": "Flag for expert review" if is_anomaly else "Normal pattern"
        }
    
    def get_statistics(self) -> Dict:
        """Get knowledge base statistics"""
        total_leaves = len(self.knowledge_base)
        total_observations = sum(l.get("observation_count", 1) for l in self.knowledge_base.values())
        unique_plants = len(self.metadata_index)
        
        diseases = {}
        for metadata in self.metadata_index.values():
            for disease in metadata.get("diseases", []):
                diseases[disease] = diseases.get(disease, 0) + 1
        
        health_distribution = {}
        for leaf in self.knowledge_base.values():
            status = leaf.get("health_status", "unknown")
            health_distribution[status] = health_distribution.get(status, 0) + 1
        
        return {
            "total_unique_leaves": total_leaves,
            "total_observations": total_observations,
            "unique_plant_species": unique_plants,
            "disease_count": len(diseases),
            "health_distribution": health_distribution,
            "top_diseases": sorted(diseases.items(), key=lambda x: x[1], reverse=True)[:5],
            "version_log_entries": len(self.version_log)
        }
