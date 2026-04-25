"""
UML Diagram AI Evaluation Service
FastAPI-based image processing service for comparing UML diagrams
using OpenCV and structural analysis.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import base64
import io
import numpy as np
import cv2
from PIL import Image
from skimage.metrics import structural_similarity as ssim

app = FastAPI(title="UML AI Evaluator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DiagramRequest(BaseModel):
    studentImage: str  # base64 encoded
    modelImage: str    # base64 encoded
    diagramType: Optional[str] = "usecase"


class MathRequest(BaseModel):
    question: str
    modelAnswer: str
    studentAnswer: str
    modelSteps: Optional[list] = []
    studentSteps: Optional[str] = ""
    maxScore: float
    tolerance: Optional[float] = 0.01
    gradingMode: Optional[str] = "final_answer"
    checkpoints: Optional[list] = []


class EvaluationResult(BaseModel):
    score: float
    feedback: str
    details: Optional[dict] = None


# ─── Utility Functions ───────────────────────────────────────────

def decode_base64_image(b64_string: str) -> np.ndarray:
    """Decode a base64 string to an OpenCV image (BGR)."""
    # Strip data URI prefix if present
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]

    img_bytes = base64.b64decode(b64_string)
    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    return cv_img


def resize_to_match(img1: np.ndarray, img2: np.ndarray) -> tuple:
    """Resize both images to the same dimensions for comparison."""
    h = max(img1.shape[0], img2.shape[0])
    w = max(img1.shape[1], img2.shape[1])
    target = (w, h)
    r1 = cv2.resize(img1, target, interpolation=cv2.INTER_AREA)
    r2 = cv2.resize(img2, target, interpolation=cv2.INTER_AREA)
    return r1, r2


def preprocess(img: np.ndarray) -> np.ndarray:
    """Convert to grayscale, apply blur, and threshold for shape detection."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    # Adaptive threshold for diagram lines
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 11, 2
    )
    return thresh


# ─── Shape Detection ─────────────────────────────────────────────

def classify_shape(contour) -> str:
    """Classify a contour into a shape category."""
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.03 * peri, True)
    vertices = len(approx)
    area = cv2.contourArea(contour)

    if area < 200:
        return "noise"

    # Circularity check
    if peri > 0:
        circularity = (4 * np.pi * area) / (peri * peri)
    else:
        circularity = 0

    if circularity > 0.7:
        return "circle"
    elif vertices == 3:
        return "triangle"
    elif vertices == 4:
        # Check aspect ratio for rectangle vs square
        x, y, w, h = cv2.boundingRect(approx)
        ratio = float(w) / h if h > 0 else 0
        if 0.85 <= ratio <= 1.15:
            return "square"
        return "rectangle"
    elif vertices == 5:
        return "pentagon"
    elif vertices >= 6 and circularity > 0.5:
        return "ellipse"
    elif vertices >= 6:
        return "polygon"
    else:
        return "unknown"


def detect_shapes(thresh_img: np.ndarray) -> dict:
    """Detect and classify shapes in a thresholded image."""
    contours, _ = cv2.findContours(
        thresh_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    shape_counts = {}
    shape_positions = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 200:
            continue

        shape = classify_shape(cnt)
        if shape == "noise":
            continue

        shape_counts[shape] = shape_counts.get(shape, 0) + 1

        M = cv2.moments(cnt)
        if M["m00"] > 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            x, y, w, h = cv2.boundingRect(cnt)
            shape_positions.append({
                "type": shape,
                "center": (cx, cy),
                "area": area,
                "bbox": (x, y, w, h)
            })

    return {
        "counts": shape_counts,
        "positions": shape_positions,
        "total": sum(shape_counts.values())
    }


def detect_lines(thresh_img: np.ndarray) -> int:
    """Detect line segments (connections/arrows) using Hough transform."""
    lines = cv2.HoughLinesP(
        thresh_img, 1, np.pi / 180,
        threshold=30, minLineLength=30, maxLineGap=15
    )
    return len(lines) if lines is not None else 0


# ─── Comparison Logic ─────────────────────────────────────────────

def compare_shape_counts(student_shapes: dict, model_shapes: dict) -> float:
    """Compare shape type distributions between student and model."""
    s_counts = student_shapes["counts"]
    m_counts = model_shapes["counts"]

    if not m_counts:
        return 1.0 if not s_counts else 0.5

    all_types = set(list(s_counts.keys()) + list(m_counts.keys()))
    if not all_types:
        return 1.0

    total_diff = 0
    total_expected = 0
    for shape_type in all_types:
        s_val = s_counts.get(shape_type, 0)
        m_val = m_counts.get(shape_type, 0)
        total_diff += abs(s_val - m_val)
        total_expected += max(s_val, m_val)

    if total_expected == 0:
        return 1.0

    return max(0, 1 - (total_diff / total_expected))


def compare_element_count(student_shapes: dict, model_shapes: dict) -> float:
    """Compare total number of elements."""
    s_total = student_shapes["total"]
    m_total = model_shapes["total"]

    if m_total == 0:
        return 1.0 if s_total == 0 else 0.5

    ratio = min(s_total, m_total) / max(s_total, m_total) if max(s_total, m_total) > 0 else 1.0
    return ratio


def compare_connections(student_lines: int, model_lines: int) -> float:
    """Compare number of connections/lines."""
    if model_lines == 0:
        return 1.0 if student_lines == 0 else 0.5

    # Allow ±30% tolerance on line count
    ratio = min(student_lines, model_lines) / max(student_lines, model_lines) if max(student_lines, model_lines) > 0 else 1.0
    return min(1.0, ratio * 1.15)  # small bonus for being close


def compare_structure_ssim(img1: np.ndarray, img2: np.ndarray) -> float:
    """Compare overall structural similarity using SSIM."""
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)

    # Resize to same dimensions
    h = min(gray1.shape[0], gray2.shape[0], 500)
    w = min(gray1.shape[1], gray2.shape[1], 500)
    gray1 = cv2.resize(gray1, (w, h))
    gray2 = cv2.resize(gray2, (w, h))

    score, _ = ssim(gray1, gray2, full=True)
    return max(0, score)


def compare_spatial_layout(student_shapes: dict, model_shapes: dict, img_shape: tuple) -> float:
    """Compare relative positions of elements using grid-based matching."""
    s_pos = student_shapes["positions"]
    m_pos = model_shapes["positions"]

    if not m_pos:
        return 1.0 if not s_pos else 0.5

    h, w = img_shape[:2]
    grid_rows, grid_cols = 3, 3
    cell_h, cell_w = h / grid_rows, w / grid_cols

    def pos_to_grid(cx, cy):
        return (min(int(cy / cell_h), grid_rows - 1),
                min(int(cx / cell_w), grid_cols - 1))

    # Build grid occupancy for both
    m_grid = {}
    for shape in m_pos:
        cx, cy = shape["center"]
        cell = pos_to_grid(cx, cy)
        key = (cell, shape["type"])
        m_grid[key] = m_grid.get(key, 0) + 1

    s_grid = {}
    for shape in s_pos:
        cx, cy = shape["center"]
        cell = pos_to_grid(cx, cy)
        key = (cell, shape["type"])
        s_grid[key] = s_grid.get(key, 0) + 1

    if not m_grid:
        return 1.0

    matched = 0
    for key, count in m_grid.items():
        s_count = s_grid.get(key, 0)
        matched += min(s_count, count)

    total_model = sum(m_grid.values())
    return matched / total_model if total_model > 0 else 1.0


# ─── Main Evaluation  ─────────────────────────────────────────────

def evaluate_diagrams(student_img: np.ndarray, model_img: np.ndarray, diagram_type: str) -> EvaluationResult:
    """Main evaluation pipeline combining multiple analysis techniques."""

    # Resize to match
    student_img, model_img = resize_to_match(student_img, model_img)

    # Preprocess
    s_thresh = preprocess(student_img)
    m_thresh = preprocess(model_img)

    # Detect shapes
    s_shapes = detect_shapes(s_thresh)
    m_shapes = detect_shapes(m_thresh)

    # Detect connections
    s_lines = detect_lines(s_thresh)
    m_lines = detect_lines(m_thresh)

    # ── Compute individual scores ──
    shape_type_score = compare_shape_counts(s_shapes, m_shapes)
    element_count_score = compare_element_count(s_shapes, m_shapes)
    connection_score = compare_connections(s_lines, m_lines)
    ssim_score = compare_structure_ssim(student_img, model_img)
    spatial_score = compare_spatial_layout(s_shapes, m_shapes, model_img.shape)

    # ── Weighted final score ──
    # Weights depend on diagram type
    weights = {
        "usecase":  {"shapes": 0.25, "count": 0.20, "connections": 0.20, "ssim": 0.15, "spatial": 0.20},
        "class":    {"shapes": 0.20, "count": 0.25, "connections": 0.25, "ssim": 0.10, "spatial": 0.20},
        "erd":      {"shapes": 0.20, "count": 0.25, "connections": 0.25, "ssim": 0.10, "spatial": 0.20},
        "activity": {"shapes": 0.25, "count": 0.20, "connections": 0.25, "ssim": 0.10, "spatial": 0.20},
        "sequence": {"shapes": 0.20, "count": 0.20, "connections": 0.20, "ssim": 0.15, "spatial": 0.25},
    }

    w = weights.get(diagram_type.lower().replace(" ", ""), weights["usecase"])

    raw_score = (
        shape_type_score * w["shapes"] +
        element_count_score * w["count"] +
        connection_score * w["connections"] +
        ssim_score * w["ssim"] +
        spatial_score * w["spatial"]
    )

    # Clamp and scale to 0-100
    final_score = round(min(100, max(0, raw_score * 100)), 1)

    # ── Generate feedback ──
    feedback_parts = []

    if element_count_score >= 0.9:
        feedback_parts.append("Element count matches well")
    elif element_count_score >= 0.6:
        feedback_parts.append(f"Some elements are missing or extra (detected {s_shapes['total']} vs expected ~{m_shapes['total']})")
    else:
        feedback_parts.append(f"Significant element count mismatch ({s_shapes['total']} vs {m_shapes['total']})")

    if shape_type_score >= 0.85:
        feedback_parts.append("Shape types are correct")
    elif shape_type_score >= 0.5:
        feedback_parts.append("Some shape types differ from the model")
    else:
        feedback_parts.append("Shape types significantly differ")

    if connection_score >= 0.8:
        feedback_parts.append("Connections look complete")
    elif connection_score >= 0.5:
        feedback_parts.append("Some connections may be missing")
    else:
        feedback_parts.append("Many connections are missing or incorrect")

    if spatial_score >= 0.7:
        feedback_parts.append("Layout is well organized")
    elif spatial_score >= 0.4:
        feedback_parts.append("Layout partially matches the model")
    else:
        feedback_parts.append("Layout differs significantly from the model")

    feedback = ". ".join(feedback_parts) + "."

    details = {
        "shapeTypeScore": round(shape_type_score * 100, 1),
        "elementCountScore": round(element_count_score * 100, 1),
        "connectionScore": round(connection_score * 100, 1),
        "structuralSimilarity": round(ssim_score * 100, 1),
        "spatialLayoutScore": round(spatial_score * 100, 1),
        "studentElements": s_shapes["total"],
        "modelElements": m_shapes["total"],
        "studentConnections": s_lines,
        "modelConnections": m_lines,
        "studentShapeTypes": s_shapes["counts"],
        "modelShapeTypes": m_shapes["counts"],
    }

    return EvaluationResult(score=final_score, feedback=feedback, details=details)


class EssayRequest(BaseModel):
    question: str
    modelAnswer: str
    studentAnswer: str
    maxScore: float


# ─── Essay Evaluation Logic ───────────────────────────────────────

def evaluate_essay_logic(req: EssayRequest) -> EvaluationResult:
    """
    Fair semantic grading assistant for essay questions.
    Uses concept-aware token matching with broad synonym bridges.
    Correctly handles: concise answers, paraphrasing, contradictions, and reversals.
    """
    import re
    
    def normalize(text):
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        return re.sub(r'\s+', ' ', text).strip()

    def tokenize(text):
        stops = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
            'of', 'and', 'or', 'to', 'it', 'its', 'their', 'they', 'this',
            'that', 'from', 'by', 'with', 'which', 'who', 'while', 'what',
            'do', 'does', 'has', 'have', 'be', 'been', 'being',
        }
        return set(t for t in text.split() if t not in stops and len(t) > 1)

    s_norm = normalize(req.studentAnswer)
    m_norm = normalize(req.modelAnswer)

    if not s_norm:
        return EvaluationResult(score=0, feedback="Empty answer.", details={"similarity": 0, "isContradicting": False, "rawRecall": 0})

    s_tokens = tokenize(s_norm)
    m_tokens = tokenize(m_norm)

    if not m_tokens:
        return EvaluationResult(score=req.maxScore, feedback="Model answer too short.", details={"similarity": 100, "isContradicting": False, "rawRecall": 1.0})

    # ── Broad Synonym Groups ──
    # Each group contains words that express the same concept
    synonym_groups = [
        # Auth & Security
        {'identity', 'identifies', 'identifying', 'identification', 'user', 'who', 'person', 'credentials'},
        {'verifies', 'verify', 'verification', 'checks', 'checking', 'check', 'confirms', 'confirming', 'validates', 'validating'},
        {'determines', 'determine', 'defines', 'defining', 'controls', 'controlling', 'decides', 'specifies'},
        {'access', 'actions', 'perform', 'permission', 'permissions', 'privileges', 'rights', 'allowed', 'resources', 'gives'},
        {'authentication', 'authenticating', 'login', 'signin'},
        {'authorization', 'authorizing', 'permissions', 'access'},
        
        # General tech/system
        {'process', 'method', 'mechanism', 'step', 'procedure', 'system', 'means'},
        {'data', 'information', 'metadata', 'records', 'content'},
        
        # OOP & Polymorphism
        {'same', 'one', 'single', 'shared', 'common'},
        {'method', 'methods', 'function', 'functions', 'interface', 'interfaces', 'action', 'actions', 'call', 'routine'},
        {'different', 'differently', 'multiple', 'various', 'distinct', 'many', 'alternative'},
        {'behavior', 'behaviors', 'implementation', 'implementations', 'response', 'responses', 'behaves', 'acts', 'works', 'does'},
        {'object', 'objects', 'class', 'classes', 'instance', 'instances', 'calling', 'caller', 'type', 'types'},
        {'polymorphism', 'polymorphic', 'overriding', 'overloading'},
        {'inheritance', 'inherits', 'extends', 'subclasses', 'derived'},
    ]

    def find_synonym_group(word):
        """Return all synonym groups a word belongs to."""
        groups = []
        for g in synonym_groups:
            if word in g:
                groups.append(g)
        return groups

    def words_are_synonyms(w1, w2):
        """Check if two words share any synonym group."""
        if w1 == w2:
            return True
        for g in synonym_groups:
            if w1 in g and w2 in g:
                return True
        return False

    # ── Concept Coverage Scoring ──
    # For each model token, check if it's covered in the student answer (directly or via synonym)
    covered_m = set()
    used_s = set()

    # Pass 1: Direct matches
    for mt in m_tokens:
        for st in s_tokens:
            if mt == st and mt not in covered_m:
                covered_m.add(mt)
                used_s.add(st)
                break

    # Pass 2: Synonym matches for remaining model tokens
    for mt in m_tokens - covered_m:
        for st in s_tokens - used_s:
            if words_are_synonyms(mt, st):
                covered_m.add(mt)
                used_s.add(st)
                break

    # Pass 3: Stem-based fuzzy match (catches "identifies"→"identity", "permissions"→"permission")
    def stem(word):
        for suffix in ['tion', 'ting', 'ing', 'ies', 'ied', 'es', 'ed', 'ly', 'er', 'al', 's']:
            if word.endswith(suffix) and len(word) - len(suffix) >= 3:
                return word[:-len(suffix)]
        return word

    for mt in m_tokens - covered_m:
        mt_stem = stem(mt)
        for st in s_tokens - used_s:
            st_stem = stem(st)
            if mt_stem == st_stem or (len(mt_stem) >= 4 and mt_stem.startswith(st_stem[:4])):
                covered_m.add(mt)
                used_s.add(st)
                break

    conceptual_recall = len(covered_m) / len(m_tokens) if m_tokens else 1.0

    # ── Contradiction / Reversal Detection ──
    # Check if concepts are associated with the WRONG terms
    # e.g., "Authentication gives permissions" is a reversal
    is_contradicting = False
    reversal_reason = ""

    auth_concepts = {'identity', 'identifies', 'identifying', 'identification', 'user', 'who', 'verifies', 'verify', 'checks', 'credentials', 'login'}
    authz_concepts = {'access', 'actions', 'perform', 'permission', 'permissions', 'privileges', 'rights', 'allowed', 'determines', 'resources', 'gives', 'controls'}

    # Split student answer around "authentication" and "authorization" to see what's associated with each
    s_words = s_norm.split()
    
    # Find positions of key terms
    auth_pos = [i for i, w in enumerate(s_words) if w.startswith('authenticat')]
    authz_pos = [i for i, w in enumerate(s_words) if w.startswith('authoriz')]

    if auth_pos and authz_pos:
        # Split the sentence into segments for each key term
        # Use midpoint between first auth and first authz mention
        first_auth = auth_pos[0]
        first_authz = authz_pos[0]
        
        if first_auth < first_authz:
            midpoint = (first_auth + first_authz) // 2
            auth_segment = set(s_words[:midpoint + 1])
            authz_segment = set(s_words[midpoint + 1:])
        else:
            midpoint = (first_authz + first_auth) // 2
            authz_segment = set(s_words[:midpoint + 1])
            auth_segment = set(s_words[midpoint + 1:])

        # Check: does the auth segment contain authz-specific concepts?
        auth_has_authz = bool(auth_segment & authz_concepts)
        # Check: does the authz segment contain auth-specific concepts?
        authz_has_auth = bool(authz_segment & auth_concepts)

        if auth_has_authz and authz_has_auth:
            is_contradicting = True
            reversal_reason = "The answer reverses the definitions of the two concepts."

    # Also check for explicit "same thing" patterns
    same_patterns = ['same thing', 'same as', 'no difference', 'identical', 'are equal', 'are same']
    for pat in same_patterns:
        if pat in s_norm:
            is_contradicting = True
            reversal_reason = "The answer incorrectly claims the concepts are identical."
            conceptual_recall = min(conceptual_recall, 0.15)
            break

    # ── OOP Specific Confused Concepts Check ──
    # Check if inheritance is substituted incorrectly when polymorphism is the main concept
    if 'polymorph' in m_norm:
        if ('inherit' in s_norm or 'extend' in s_norm) and not any(k in s_norm for k in ['behavior', 'differ', 'same', 'implement']):
            is_contradicting = True
            reversal_reason = "The answer incorrectly defines polymorphism using inheritance concepts."
            conceptual_recall = min(conceptual_recall, 0.20)
    # ── Multi-Part Coverage Check ──
    # If the question asks about multiple concepts, the student MUST address ALL parts
    coverage_penalty = 1.0  # no penalty by default
    coverage_note = ""
    
    q_norm = normalize(req.question)
    
    # Detect multi-part questions
    multi_part_patterns = [
        'difference between', 'differences between',
        'compare', 'comparison', 'distinguish',
        'contrast', 'vs', 'versus',
    ]
    is_multi_part = any(pat in q_norm for pat in multi_part_patterns)
    
    # Also detect "explain X and Y" patterns
    if not is_multi_part and ' and ' in q_norm:
        # Check if there are at least 2 capitalized/key nouns around "and" in the original question
        q_words = req.question.split()
        and_positions = [i for i, w in enumerate(q_words) if w.lower() == 'and']
        for ap in and_positions:
            before = q_words[max(0, ap-3):ap]
            after = q_words[ap+1:min(len(q_words), ap+4)]
            # If words around "and" start with uppercase, it's likely comparing named concepts
            has_named_before = any(w[0].isupper() for w in before if len(w) > 1)
            has_named_after = any(w[0].isupper() for w in after if len(w) > 1)
            if has_named_before and has_named_after:
                is_multi_part = True
                break

    if is_multi_part:
        # Extract key concept terms from the model answer
        # Split model answer by conjunctions/delimiters to find distinct concept segments
        m_words = m_norm.split()
        
        # Find concept anchors: terms that appear in the question and define concepts to explain
        q_tokens = tokenize(q_norm)
        # Look for named concepts (typically the nouns being compared)
        concept_anchors = []
        for qt in q_tokens:
            if len(qt) > 3 and qt not in {'explain', 'difference', 'differences', 'between', 'compare', 'contrast', 'describe', 'discuss', 'what'}:
                concept_anchors.append(qt)
        
        if len(concept_anchors) >= 2:
            # Check which concept anchors are addressed in the student answer
            addressed = 0
            total = len(concept_anchors)
            for anchor in concept_anchors:
                # Check if student mentions this concept (directly or via stem)
                anchor_stem = stem(anchor)
                found = False
                for sw in s_norm.split():
                    if sw == anchor or stem(sw) == anchor_stem:
                        found = True
                        break
                if found:
                    addressed += 1
            
            coverage_ratio = addressed / total
            
            if coverage_ratio < 1.0:
                # Partial coverage: cap the similarity
                # 1 of 2 concepts → cap at ~55% (medium score)
                # 1 of 3 concepts → cap at ~40%
                coverage_penalty = 0.45 + (coverage_ratio * 0.35)
                missing_count = total - addressed
                coverage_note = f" Only {addressed}/{total} required concepts addressed ({missing_count} missing)."

    # ── Similarity Calculation with Conciseness Fairness ──
    # Core rule: a concise but correct answer should NOT be penalized heavily
    
    if is_contradicting:
        similarity = max(0.05, conceptual_recall * 0.2)
    else:
        similarity = conceptual_recall
        # Conciseness boost: if recall >= 0.4 (covered some real concepts), 
        # apply a diminishing-gap boost that rewards correctness over verbosity
        if 0.35 <= similarity < 1.0:
            gap = 1.0 - similarity
            boost_factor = 0.7 + (similarity * 0.2)
            similarity = min(1.0, similarity + gap * boost_factor)
        
        # Apply multi-part coverage penalty AFTER boost
        if coverage_penalty < 1.0:
            similarity = min(similarity, coverage_penalty)

    sim_pct = round(similarity * 100, 1)

    # ── Scoring Bands ──
    if sim_pct >= 95:
        score = req.maxScore
        reason = "Excellent. Perfectly captures the core meaning."
    elif sim_pct >= 90:
        score = req.maxScore * 0.95
        reason = "Excellent. Very high conceptual alignment with the model answer."
    elif sim_pct >= 80:
        score = req.maxScore * 0.88
        reason = "Very good. Core concepts are correct, minor details differ."
    elif sim_pct >= 70:
        score = req.maxScore * 0.78
        reason = "Good. Shows clear understanding with some missing nuance."
    elif sim_pct >= 50:
        score = req.maxScore * 0.60
        reason = "Partial understanding. Some core concepts present but incomplete."
    elif sim_pct >= 25:
        score = req.maxScore * 0.30
        reason = "Weak understanding. Conceptual alignment is low."
    else:
        score = 0
        reason = "Incorrect or irrelevant answer."

    if is_contradicting:
        reason = f"Contradiction Detected: {reversal_reason} {reason}"

    if coverage_note:
        reason += coverage_note

    # ── Rich Feedback Generation (does NOT alter any scoring) ──
    # Build sub-dimension breakdown based on already-computed metrics
    total_m = len(m_tokens) if m_tokens else 1
    covered_count = len(covered_m)
    uncovered_tokens = list(m_tokens - covered_m)
    extra_tokens = list(s_tokens - used_s)  # student tokens not matched to any model token

    # Sub-scores derived from existing metrics (informational only — score unchanged)
    content_understanding_max = 5
    accuracy_max = 3
    clarity_max = 2

    if is_contradicting:
        content_score = max(0, round(conceptual_recall * content_understanding_max * 0.3))
        accuracy_score = 0
    else:
        content_score = round(min(content_understanding_max, conceptual_recall * content_understanding_max * 1.1), 1)
        accuracy_score = accuracy_max if not is_contradicting and conceptual_recall >= 0.7 else (
            round(accuracy_max * 0.6) if conceptual_recall >= 0.4 else 0
        )

    # Clarity approximation: reward concise, focused answers
    verbosity_ratio = len(s_tokens) / max(len(m_tokens), 1)
    if verbosity_ratio > 3.0:
        clarity_score = round(clarity_max * 0.4, 1)  # very verbose
    elif verbosity_ratio > 2.0:
        clarity_score = round(clarity_max * 0.7, 1)
    elif conceptual_recall >= 0.5:
        clarity_score = clarity_max  # concise and correct
    else:
        clarity_score = round(clarity_max * 0.5, 1)

    breakdown = {
        "contentUnderstanding": {"score": content_score, "max": content_understanding_max},
        "accuracy": {"score": accuracy_score, "max": accuracy_max},
        "clarity": {"score": clarity_score, "max": clarity_max},
    }

    if is_multi_part:
        coverage_score_val = round(coverage_penalty * 2, 1) if coverage_penalty < 1.0 else 2
        breakdown["conceptCoverage"] = {"score": coverage_score_val, "max": 2}

    # ── Identify Strengths ──
    strengths = []
    if conceptual_recall >= 0.8:
        strengths.append("Strong understanding of the main concepts")
    elif conceptual_recall >= 0.5:
        strengths.append("Demonstrates partial understanding of core ideas")

    if not is_contradicting and conceptual_recall >= 0.4:
        strengths.append("No contradictions or factual reversals detected")

    if 0.5 <= verbosity_ratio <= 2.0 and conceptual_recall >= 0.5:
        strengths.append("Concise and well-focused response")

    if is_multi_part and coverage_penalty >= 1.0:
        strengths.append("All required concepts were addressed")

    # Check for specific matched concepts
    if covered_count >= 3:
        sample_matched = sorted(list(covered_m))[:3]
        strengths.append(f"Key terms covered: {', '.join(sample_matched)}")

    # ── Identify Weaknesses ──
    weaknesses = []
    if is_contradicting:
        weaknesses.append(f"Contradiction detected: {reversal_reason}")

    if len(uncovered_tokens) > 0:
        missing_display = sorted(uncovered_tokens)[:5]
        weaknesses.append(f"Missing important concepts: {', '.join(missing_display)}")

    if is_multi_part and coverage_penalty < 1.0:
        weaknesses.append(coverage_note.strip())

    if conceptual_recall < 0.3:
        weaknesses.append("Very low alignment with the expected answer")

    if verbosity_ratio > 3.0:
        weaknesses.append("Response is overly verbose — key points may be diluted")

    if conceptual_recall < 0.5 and not is_contradicting:
        weaknesses.append("Several core ideas from the model answer are not addressed")

    # ── Improvement Suggestions ──
    suggestions = []
    if len(uncovered_tokens) > 0:
        top_missing = sorted(uncovered_tokens)[:3]
        suggestions.append(f"Include more details about: {', '.join(top_missing)}")

    if is_contradicting:
        suggestions.append("Review the definitions carefully — make sure each concept is described accurately")

    if is_multi_part and coverage_penalty < 1.0:
        suggestions.append("Make sure to address ALL parts of the question, not just one concept")

    if verbosity_ratio > 2.5:
        suggestions.append("Try to be more concise — focus on the key points rather than lengthy explanations")

    if conceptual_recall < 0.5 and not is_contradicting:
        suggestions.append("Study the core concepts more thoroughly and use precise terminology")

    if conceptual_recall >= 0.7 and conceptual_recall < 0.9:
        suggestions.append("Good foundation — adding a bit more detail or precision would improve your score")

    if not suggestions:
        suggestions.append("Keep up the excellent work!")

    return EvaluationResult(
        score=round(score, 2),
        feedback=reason,
        details={
            "similarity": round(sim_pct, 1),
            "isContradicting": is_contradicting,
            "rawRecall": round(conceptual_recall, 2),
            "breakdown": breakdown,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "suggestions": suggestions,
            "coveredConcepts": sorted(list(covered_m))[:10],
            "missingConcepts": sorted(uncovered_tokens)[:10],
        }
    )


def evaluate_math_logic(req: MathRequest) -> EvaluationResult:
    """
    Evaluates math answers based on final answer correctness and step logic.
    """
    import re

    def normalize_math(text):
        if not text: return ""
        # Handle LaTeX specifically
        if "\\" in text:
            # Convert \frac{a}{b} to (a)/(b)
            text = re.sub(r'\\frac\{([\s\S]*?)\}\{([\s\S]*?)\}', r'(\1)/(\2)', text)
            # Convert \times to *
            text = text.replace('\\times', '*')
            # Remove other common LaTeX wrappers but keep content
            text = re.sub(r'\\[a-z]+', ' ', text)
            text = text.replace('{', '(').replace('}', ')')
        
        text = text.lower().strip()
        
        # Remove common prefixes like "=", "x=", "ans:", "result:"
        while True:
            old_len = len(text)
            text = re.sub(r'^(x|y|z|ans|result|answer|value|val)\s*[:=]\s*', '', text)
            text = re.sub(r'^[:=]\s*', '', text)
            text = text.strip()
            if len(text) == old_len:
                break
                
        return text.replace(" ", "")

    def is_numerically_equal(s1, s2, tol):
        s1_norm = normalize_math(s1)
        s2_norm = normalize_math(s2)
        
        print(f"[MATH DEBUG] s1_raw='{s1}' -> norm='{s1_norm}'")
        print(f"[MATH DEBUG] s2_raw='{s2}' -> norm='{s2_norm}'")
        
        if s1_norm == s2_norm: 
            print("[MATH DEBUG] Direct string match")
            return True
        
        try:
            def prepare_for_eval(s):
                return s.replace('^', '**')

            v1_str = prepare_for_eval(s1_norm)
            v2_str = prepare_for_eval(s2_norm)

            try:
                v1 = float(v1_str)
                v2 = float(v2_str)
                res = abs(v1 - v2) <= tol
                print(f"[MATH DEBUG] Float comparison: {v1} vs {v2} (tol {tol}) -> {res}")
                return res
            except ValueError:
                pass

            safe_chars = set("0123456789./*-+()e")
            v1_clean = "".join(c for c in v1_str if c in safe_chars)
            v2_clean = "".join(c for c in v2_str if c in safe_chars)
            
            if v1_clean and v2_clean:
                v1 = eval(v1_clean, {"__builtins__": {}}, {})
                v2 = eval(v2_clean, {"__builtins__": {}}, {})
                res = abs(float(v1) - float(v2)) <= tol
                print(f"[MATH DEBUG] Eval comparison: {v1} vs {v2} (tol {tol}) -> {res}")
                return res
        except Exception as e:
            print(f"[MATH DEBUG] Comparison error: {str(e)}")
            
        return False

    final_correct = is_numerically_equal(req.studentAnswer, req.modelAnswer, req.tolerance if req.tolerance is not None else 0.01)
    
    if req.gradingMode == "checkpoints" and req.checkpoints:
        matches = 0
        matched_cps = []
        s_steps_norm = normalize_math(req.studentSteps)
        
        for cp in req.checkpoints:
            cp_norm = normalize_math(cp)
            if cp_norm and cp_norm in s_steps_norm:
                matches += 1
                matched_cps.append(cp)
            else:
                parts = re.split(r'[,;\n\]\[]+', req.studentSteps)
                matched = False
                for p in parts:
                    if is_numerically_equal(cp, p, req.tolerance or 0.01):
                        matched = True
                        break
                    subparts = p.split('=')
                    for sp in subparts:
                        if is_numerically_equal(cp, sp, req.tolerance or 0.01):
                            matched = True
                            break
                    if matched: break
                
                if matched:
                    matches += 1
                    matched_cps.append(cp)
        
        cp_ratio = matches / len(req.checkpoints)
        total_score = ((1.0 if final_correct else 0) * 0.6 * req.maxScore) + (cp_ratio * 0.4 * req.maxScore)
        
        feedback = "Final answer is correct." if final_correct else "Final answer is incorrect."
        if cp_ratio == 1.0:
            feedback += " All required intermediate checkpoints successfully reached."
        elif cp_ratio > 0:
            feedback += f" Partial credit awarded: Found {matches} out of {len(req.checkpoints)} checkpoints."
        else:
            feedback += " No required intermediate checkpoints were found."
            
        return EvaluationResult(
            score=round(total_score, 2),
            feedback=feedback,
            details={
                "finalAnswerCorrect": final_correct,
                "checkpointsMode": True,
                "checkpointsRatio": round(cp_ratio, 2),
                "matchedCheckpoints": matched_cps
            }
        )

    # Final Answer Only mode (or fallback)
    # If there are no checkpoints and it is final answer only, grade primarily on final answer
    total_score = req.maxScore if final_correct else 0.0
    
    feedback = "Final answer is correct." if final_correct else "Final answer is incorrect."
    
    return EvaluationResult(
        score=round(total_score, 2),
        feedback=feedback,
        details={
            "finalAnswerCorrect": final_correct,
            "checkpointsMode": False
        }
    )


# ─── API Endpoints ────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Exam AI Evaluator (UML + Essay)"}


@app.post("/evaluate-diagram", response_model=EvaluationResult)
async def evaluate_diagram(request: DiagramRequest):
    """Evaluate a student's UML diagram against a model diagram using AI image processing."""
    try:
        student_img = decode_base64_image(request.studentImage)
        model_img = decode_base64_image(request.modelImage)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode images: {str(e)}")

    try:
        result = evaluate_diagrams(student_img, model_img, request.diagramType or "usecase")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@app.post("/evaluate-essay", response_model=EvaluationResult)
async def evaluate_essay(request: EssayRequest):
    """Evaluate an essay answer semantically following the 'Fair Assistant' prompt logic."""
    try:
        result = evaluate_essay_logic(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Essay evaluation failed: {str(e)}")


@app.post("/evaluate-math", response_model=EvaluationResult)
async def evaluate_math(request: MathRequest):
    """Evaluate a math question based on final answer and steps."""
    try:
        result = evaluate_math_logic(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Math evaluation failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
