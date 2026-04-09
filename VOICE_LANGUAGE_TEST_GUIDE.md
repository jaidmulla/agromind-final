# 🎤 Voice & Language System - Test Guide

**Deployment Date:** April 9, 2026  
**Status:** ✅ DEPLOYED AND HEALTHY

---

## 🚀 Quick Start

1. Open **http://localhost:3000** in Chrome (best browser for voice features)
2. Sign in with your account
3. Navigate to **AI Doctor Chat** section
4. Follow the test cases below

---

## ✅ Test Case 1: Voice Input Auto-Stop (Frontend Fix)

**Objective:** Verify microphone auto-starts on button click (NOT on page load)

**Steps:**
1. Refresh the page
2. Open browser console (F12 → Console)
3. Verify NO audio input starts automatically
4. Click the 🎤 **Microphone button**
5. Button should turn RED with pulse animation
6. Verify you can speak
7. Click the button again (or wait for speech to end)
8. Button should return to normal grey state

**Expected Result:** ✅ Microphone ONLY starts on explicit button click  
**Actual Result:** _________

---

## ✅ Test Case 2: Voice Output Stop Toggle (Frontend Fix)

**Objective:** Verify Listen/Stop button in messages works correctly

**Steps:**
1. Send a message: "What is crop rotation?"
2. Wait for AI response (in any language)
3. Hover over the assistant message
4. Click the 🔊 **Listen button** below the message
5. Verify speaker output starts (or simulates if headphones muted)
6. Button text changes to "Stop" (red text with pulse)
7. Click **Stop** button
8. Verify audio stops immediately
9. Button text changes back to "Listen" (grey)

**Expected Result:** ✅ Listen/Stop toggle works without auto-speak  
**Actual Result:** _________

---

## ✅ Test Case 3: Hindi Language Enforcement

**Objective:** Verify responses in Hindi ONLY (देवनागरी script) when Hindi is selected

**Setup:**
1. Select 🇮🇳 **हिन्दी** from language selector

**Test Messages:**
```
1. "मेरी फसल में क्या रोग है?" 
   (What disease is my crop suffering from?)

2. "गेहूं में खाद कब डालूँ?"
   (When should I apply fertilizer to wheat?)

3. "फसल बचाने के लिए क्या करूँ?"
   (What should I do to save my crop?)
```

**Verification:**
- [ ] Response appears ONLY in Hindi (देवनागरी script)
- [ ] NO English words present
- [ ] NO Roman numerals (use "२०२६" instead of "2026")
- [ ] NO acronyms or abbreviations in English

**Expected Structure:**
```
विवरण (Description): आपकी फसल की स्थिति...
समस्या (Problem): संभावित कारण...
समाधान (Solution): इलाज के लिए यह करें...
आगे की कार्रवाई (Next Action): अगला कदम...
```

**Expected Result:** ✅ 100% Hindi response with Devanagari script  
**Actual Result:** _________

---

## ✅ Test Case 4: Marathi Language Enforcement

**Objective:** Verify responses in Marathi ONLY (देवनागरी script) when Marathi is selected

**Setup:**
1. Select 🇮🇳 **मराठी** from language selector

**Test Messages:**
```
1. "माझल्या पिकाला कोणते रोग आहे?"
   (What disease does my crop have?)

2. "डाळी पिकास खत कधी द्यावे?"
   (When should I apply fertilizer to pulses?)

3. "पिक वाचवण्यासाठी काय करावे?"
   (What to do to save the crop?)
```

**Verification:**
- [ ] Response appears ONLY in Marathi (देवनागरी script)
- [ ] NO English words present
- [ ] NO Roman numerals (use "२०२६" instead of "2026")
- [ ] NO acronyms or abbreviations in English

**Expected Structure:**
```
विवरण (Description): तुमच्या पिकाची स्थिती...
समस्या (Problem): संभाव्य कारण...
समाधान (Solution): उपचारासाठी हे करा...
पुढील कार्य (Next Action): पुढचा पाऊल...
```

**Expected Result:** ✅ 100% Marathi response with Devanagari script  
**Actual Result:** _________

---

## ✅ Test Case 5: English Language (Baseline)

**Objective:** Verify English responses work as baseline

**Setup:**
1. Select 🇮🇳 **English** from language selector

**Test Messages:**
```
1. "What disease affects my wheat crop?"
2. "When should I apply fertilizers?"
3. "How can I prevent crop failure?"
```

**Verification:**
- [ ] Response appears in English
- [ ] Clear, actionable advice format
- [ ] Product names and prices in ₹ mentioned
- [ ] Footer message shows "Speak in Hindi, Marathi, or English"

**Expected Result:** ✅ Clear English responses with context awareness  
**Actual Result:** _________

---

## 🎤 Advanced Test: Voice Input with Language Switching

**Objective:** Test voice input correctly detects and switches languages

**Test Case 5A: Hindi Voice Input**
1. Select 🇮🇳 **हिन्दी**
2. Click 🎤 microphone
3. Speak in Hindi (say "गेहूँ की खेती")
4. Wait 3 seconds for recognition to complete
5. Text should appear in input box
6. Press Send
7. Verify response is in Hindi (देवनागरी)

**Expected Result:** ✅ Hindi speech recognized and responded in Hindi  
**Actual Result:** _________

**Test Case 5B: Marathi Voice Input**
1. Select 🇮🇳 **मराठी**
2. Click 🎤 microphone
3. Speak in Marathi (say "डाळीचे खेत")
4. Wait 3 seconds for recognition to complete
5. Text should appear in input box
6. Press Send
7. Verify response is in Marathi (देवनागरी)

**Expected Result:** ✅ Marathi speech recognized and responded in Marathi  
**Actual Result:** _________

---

## 🔊 Voice Output Test with Language

**Test Case 6A: Listen Button - Hindi Response**
1. Select 🇮🇳 **हिन्दी**
2. Send a question about crops
3. Wait for Hindi response
4. Hover over response and click 🔊 **Listen**
5. Audio should play in Hindi (or attempt to, based on browser support)
6. Button shows "Stop" in red
7. Click "Stop" button
8. Audio stops

**Expected Result:** ✅ Listen button controls Hindi audio output  
**Actual Result:** _________

**Test Case 6B: Listen Button - Marathi Response**
1. Select 🇮🇳 **मराठी**
2. Send a question about crops
3. Wait for Marathi response
4. Hover over response and click 🔊 **Listen**
5. Audio should play in Marathi (or attempt to, based on browser support)
6. Button shows "Stop" in red
7. Click "Stop" button
8. Audio stops

**Expected Result:** ✅ Listen button controls Marathi audio output  
**Actual Result:** _________

---

## 🔍 Backend Diagnostics

### Check Language Detection is Working

Open browser console and monitor API calls:

```javascript
// In browser console (F12)
// When you send a message, check Network tab
// Look for POST /api/v1/chat
// Check response: "language": "hi" | "mr" | "en"
```

Expected patterns in response:
```json
{
  "success": true,
  "data": {
    "reply": "हिन्दी में जवाब...",
    "language": "hi",
    "context": {
      "location": "Kolhapur, Maharashtra",
      "crops_count": 2,
      "active_alerts": 1,
      "disease_risk_score": 42
    },
    "performance": {
      "response_time_ms": 2341,
      "ai_service": "openai"
    }
  }
}
```

### Check Database Chat History

```bash
# SSH into database or use pgAdmin
SELECT language, COUNT(*) FROM chat_history 
GROUP BY language;

# Expected: 
# language | count
# ----------+-------
# en       | 5
# hi       | 3
# mr       | 2
```

---

## ⚠️ Known Issues & Workarounds

### Issue 1: Browser Speech Recognition Not Available
**Symptom:** Microphone button doesn't work  
**Cause:** Some browsers don't support Web Speech API  
**Fix:** Use Chrome or Edge browser

### Issue 2: Speech Synthesis Not Available
**Symptom:** Listen button doesn't play audio  
**Cause:** Browser or system doesn't support speech synthesis  
**Fix:** Check browser settings or use different browser

### Issue 3: Hindi/Marathi Shows English
**Symptom:** Selected Hindi but got English response  
**Cause:** Language detection fallback or OpenAI ignoring instructions  
**Fix:** 
1. Check backend logs: `docker logs agromind-backend | grep CRITICAL`
2. If "Language mismatch detected" appears, system attempted re-translation
3. Try again with different prompt

---

## 📊 Test Results Summary

| Test # | Feature | Status | Notes |
|--------|---------|--------|-------|
| 1 | Voice Auto-Stop | ⬜ | Microphone should NOT auto-start |
| 2 | Listen/Stop Toggle | ⬜ | Button should toggle on hover |
| 3 | Hindi Enforcement | ⬜ | 100% Devanagari script |
| 4 | Marathi Enforcement | ⬜ | 100% Devanagari script |
| 5 | English Baseline | ⬜ | Clear English responses |
| 5A | Hindi Voice Input | ⬜ | Voice recognized & responded |
| 5B | Marathi Voice Input | ⬜ | Voice recognized & responded |
| 6A | Hindi Audio Output | ⬜ | Listen button works |
| 6B | Marathi Audio Output | ⬜ | Listen button works |

---

## 🐛 Debugging Commands

```bash
# View backend logs
docker logs agromind-backend -f --tail=50

# Check for language enforcement messages
docker logs agromind-backend | grep -i "language\|critical\|hindi\|marathi"

# View chat history in database
docker exec agromind-db psql -U agromind -d agromind_db -c \
  "SELECT DATE(created_at), language, COUNT(*) FROM chat_history GROUP BY DATE(created_at), language ORDER BY DATE(created_at) DESC LIMIT 20;"

# Check API response
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "नमस्ते", "language": "hi"}'
```

---

## ✅ Sign-Off Checklist

Once all tests pass, mark this section:

- [ ] Test 1: Voice Auto-Stop - PASS
- [ ] Test 2: Listen/Stop Toggle - PASS
- [ ] Test 3: Hindi Enforcement - PASS
- [ ] Test 4: Marathi Enforcement - PASS
- [ ] Test 5: English Baseline - PASS
- [ ] Test 5A: Hindi Voice Input - PASS
- [ ] Test 5B: Marathi Voice Input - PASS
- [ ] Test 6A: Hindi Audio Output - PASS
- [ ] Test 6B: Marathi Audio Output - PASS
- [ ] No console errors (F12)
- [ ] Database chat_history table has records in correct languages
- [ ] All 5 Docker services healthy

**Sign-Off Date:** _________  
**Tested By:** _________  
**Status:** ⬜ PENDING / ✅ APPROVED

---

## 📞 Support

If tests fail:

1. **Check Docker logs:**
   ```bash
   ./verify-system.sh
   docker logs agromind-backend
   docker logs agromind-frontend
   ```

2. **Check browser console (F12):**
   - Look for errors in Console tab
   - Check Network tab for API errors

3. **Verify code was deployed:**
   ```bash
   grep -n "NO AUTO-SPEAK" frontend/src/app/pages/AIDoctorChat.tsx
   grep -n "detectLanguage" backend/src/controllers/chat.controller.ts
   ```

4. **Run full rebuild:**
   ```bash
   ./rebuild.sh
   sleep 10
   ./verify-system.sh
   ```

---

**Last Updated:** April 9, 2026  
**Implementation:** Comprehensive voice system overhaul with strict language enforcement  
**Deployment Status:** ✅ COMPLETE
