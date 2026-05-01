#!/usr/bin/env python3
"""
🧠 AgroMind LeafAI — Python API Examples
Demonstrates all LeafAI operations with real Python code
"""

import requests
import json
from pathlib import Path
from typing import Dict, Optional

class LeafAIClient:
    """Python client for AgroMind LeafAI service"""
    
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def health_check(self) -> Dict:
        """Check if ML service is running"""
        response = self.session.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()
    
    def identify_leaf(self, image_path: str) -> Dict:
        """
        🌿 Identify a leaf from image
        
        Args:
            image_path: Path to leaf image file
        
        Returns:
            Leaf identification result with all metadata
        """
        with open(image_path, 'rb') as f:
            files = {'image': f}
            response = self.session.post(
                f"{self.base_url}/leafai/identify",
                files=files
            )
        response.raise_for_status()
        return response.json()
    
    def identify_manual(self,
                       image_path: Optional[str],
                       common_name: str,
                       scientific_name: str,
                       family: str,
                       health_status: str = "Healthy",
                       confidence: float = 95.0) -> Dict:
        """
        🌿 Manually register a leaf with expert metadata
        
        Args:
            image_path: Optional path to leaf image
            common_name: Common name of plant
            scientific_name: Scientific/Latin name
            family: Botanical family
            health_status: Healthy/Diseased/Deficient/Stressed
            confidence: Confidence score 0-100
        
        Returns:
            Registration result
        """
        files = {}
        if image_path:
            files['image'] = open(image_path, 'rb')
        
        data = {
            'common_name': common_name,
            'scientific_name': scientific_name,
            'family': family,
            'health_status': health_status,
            'confidence': confidence
        }
        
        response = self.session.post(
            f"{self.base_url}/leafai/identify/manual",
            files=files,
            data=data
        )
        response.raise_for_status()
        return response.json()
    
    def get_leaf(self, leaf_id: str) -> Dict:
        """Retrieve stored leaf record"""
        response = self.session.get(f"{self.base_url}/leafai/leaf/{leaf_id}")
        response.raise_for_status()
        return response.json()
    
    def predict_yield(self, leaf_id: str) -> Dict:
        """
        📊 Predict crop yield and disease severity for a leaf
        
        Returns:
            - health_score (0-100)
            - predicted_yield_tons_per_acre
            - disease_severity_0_to_10
            - estimated_days_to_harvest
        """
        response = self.session.post(f"{self.base_url}/leafai/regression/{leaf_id}")
        response.raise_for_status()
        return response.json()
    
    def find_similar_leaves(self, plant_name: str) -> Dict:
        """Find similar leaves in knowledge base"""
        response = self.session.get(
            f"{self.base_url}/leafai/knowledge-base/search",
            params={"plant_name": plant_name}
        )
        response.raise_for_status()
        return response.json()
    
    def clustering_analysis(self, limit: int = 10) -> Dict:
        """
        🔀 Perform unsupervised clustering of leaves
        
        Returns groups of similar leaves discovered automatically
        """
        response = self.session.get(
            f"{self.base_url}/leafai/clustering",
            params={"limit": limit}
        )
        response.raise_for_status()
        return response.json()
    
    def detect_anomalies(self) -> Dict:
        """
        🚨 Detect anomalous/unusual leaf patterns
        
        Returns leaves that are rare or show unusual patterns
        """
        response = self.session.get(f"{self.base_url}/leafai/anomalies")
        response.raise_for_status()
        return response.json()
    
    def kb_statistics(self) -> Dict:
        """Get knowledge base statistics"""
        response = self.session.get(f"{self.base_url}/leafai/knowledge-base/stats")
        response.raise_for_status()
        return response.json()


# ════════════════════════════════════════════════════════════════════════════════
# 📋 EXAMPLE USAGE
# ════════════════════════════════════════════════════════════════════════════════

def main():
    """Demonstrate all LeafAI operations"""
    
    client = LeafAIClient(base_url="http://localhost:5000")
    
    print("\n" + "="*80)
    print("🧠 AgroMind LeafAI — Python API Demonstration")
    print("="*80 + "\n")
    
    # 1. Health check
    print("1️⃣  Checking service health...")
    try:
        health = client.health_check()
        print(f"✅ Service Status: {health}")
        print()
    except Exception as e:
        print(f"❌ Service not available: {e}")
        print("   Start the ML service: python ml-service/main.py")
        return
    
    # 2. Identify a leaf from image
    print("2️⃣  Identifying a leaf from image...")
    image_path = Path("test_leaf.jpg")
    if image_path.exists():
        try:
            result = client.identify_leaf(str(image_path))
            print(f"✅ Leaf identified: {result['common_name']}")
            print(f"   Confidence: {result['confidence_score']}%")
            print(f"   Health: {result['health_status']}")
            print(f"   Leaf ID: {result['leaf_id']}")
            
            leaf_id = result['leaf_id']
            
            # 3. Get predictions for this leaf
            print("\n3️⃣  Predicting crop yield and disease severity...")
            predictions = client.predict_yield(leaf_id)
            print(f"✅ Predictions generated:")
            print(f"   Health Score: {predictions['health_score']}/100")
            print(f"   Predicted Yield: {predictions['predicted_yield_tons_per_acre']} tons/acre")
            print(f"   Disease Severity: {predictions['disease_severity_0_to_10']}/10")
            print(f"   Days to Harvest: {predictions['estimated_days_to_harvest']}")
            
        except FileNotFoundError:
            print(f"⚠️  No test image found at {image_path}")
            print("   Please provide a leaf image file")
    else:
        print(f"⚠️  Test image not found: {image_path}")
        print("   Example: Place a leaf image as test_leaf.jpg in current directory")
    
    # 4. Manual registration
    print("\n4️⃣  Registering a leaf manually (no image)...")
    try:
        manual_result = client.identify_manual(
            image_path=None,
            common_name="Tomato",
            scientific_name="Solanum lycopersicum",
            family="Solanaceae",
            health_status="Diseased",
            confidence=92.5
        )
        print(f"✅ Leaf registered: {manual_result}")
        manual_leaf_id = manual_result.get('leaf_id')
    except Exception as e:
        print(f"⚠️  Manual registration failed: {e}")
    
    # 5. Search knowledge base
    print("\n5️⃣  Searching knowledge base for Tomato leaves...")
    try:
        search_results = client.find_similar_leaves("Tomato")
        print(f"✅ Found {search_results['total_results']} similar leaves")
        for leaf in search_results['results'][:3]:
            print(f"   - {leaf['common_name']}: {leaf['confidence']}% confidence")
    except Exception as e:
        print(f"⚠️  Search failed: {e}")
    
    # 6. Clustering analysis
    print("\n6️⃣  Analyzing leaf clusters (unsupervised)...")
    try:
        clusters = client.clustering_analysis(limit=10)
        print(f"✅ Clustering complete: {clusters['clusters_created']} clusters found")
        print(f"   Total leaves analyzed: {clusters['total_leaves_analyzed']}")
        for cluster_id, leaf_ids in clusters['cluster_groups'].items():
            print(f"   - Cluster {cluster_id}: {len(leaf_ids)} leaves")
    except Exception as e:
        print(f"⚠️  Clustering failed: {e}")
    
    # 7. Anomaly detection
    print("\n7️⃣  Detecting anomalous leaf patterns...")
    try:
        anomalies = client.detect_anomalies()
        print(f"✅ Anomaly detection complete:")
        print(f"   Total anomalies found: {anomalies['total_anomalies']}")
        print(f"   Critical alerts: {anomalies['critical_count']}")
        for anomaly in anomalies['anomalous_leaves'][:3]:
            print(f"   - {anomaly['common_name']}: {anomaly['alert_level']}")
    except Exception as e:
        print(f"⚠️  Anomaly detection failed: {e}")
    
    # 8. Knowledge base statistics
    print("\n8️⃣  Knowledge base statistics...")
    try:
        stats = client.kb_statistics()
        print(f"✅ KB Statistics:")
        print(f"   Total unique leaves: {stats['total_unique_leaves']}")
        print(f"   Total observations: {stats['total_observations']}")
        print(f"   Unique plant species: {stats['unique_plant_species']}")
        print(f"   Diseases documented: {stats['disease_count']}")
        print(f"   Data integrity: {stats['data_integrity']}")
    except Exception as e:
        print(f"⚠️  Stats failed: {e}")
    
    print("\n" + "="*80)
    print("🎉 Demo complete!")
    print("📚 For full documentation, see LEAFAI_DOCUMENTATION.md")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
