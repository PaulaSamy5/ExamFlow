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
    
    print(f"DEBUG: s1='{s1}' -> '{s1_norm}', s2='{s2}' -> '{s2_norm}'")
    
    if s1_norm == s2_norm: 
        return True
    
    try:
        def prepare_for_eval(s):
            return s.replace('^', '**')

        v1_str = prepare_for_eval(s1_norm)
        v2_str = prepare_for_eval(s2_norm)

        try:
            v1 = float(v1_str)
            v2 = float(v2_str)
            return abs(v1 - v2) <= tol
        except ValueError:
            pass

        safe_chars = set("0123456789./*-+()e")
        v1_clean = "".join(c for c in v1_str if c in safe_chars)
        v2_clean = "".join(c for c in v2_str if c in safe_chars)
        
        if v1_clean and v2_clean:
            v1 = eval(v1_clean, {"__builtins__": {}}, {})
            v2 = eval(v2_clean, {"__builtins__": {}}, {})
            return abs(float(v1) - float(v2)) <= tol
    except Exception as e:
        print(f"Error: {e}")
        
    return False

# Test Cases
tests = [
    ("45", "45", True),
    ("45.0", "45", True),
    ("=45", "45", True),
    ("ans=45", "45", True),
    ("x = 45", "45", True),
    ("44.999", "45", True),
    ("1/2", "0.5", True),
    ("\\frac{1}{2}", "0.5", True),
    ("ans: 0.5", "0.5", True),
    ("44", "45", False),
]

for s, c, expected in tests:
    res = is_numerically_equal(s, c, 0.01)
    print(f"Test '{s}' vs '{c}': Got {res}, Expected {expected} -> {'PASS' if res == expected else 'FAIL'}")
