const detectLanguage = (code) => {
  if (!code || code.trim().length < 5) return null;
  const c = code.toLowerCase();
  
  const patterns = {
    javascript: [
      'console.log', 'const ', 'let ', 'require(', 'await ', 'function', '=>',
      'import {', 'document.get', 'export ', 'Object.keys'
    ],
    python: [
      'print(', 'def ', 'import ', 'if __name__', 'elif ', 'class ', 'range(', 
      'for i in', 'lambda ', 'try:', 'except ', 'with open'
    ],
    cpp: [
      '#include', 'iostream', 'std::', 'using namespace', 'cout <<', 'cin >>', 
      'int main()', 'vector<', 'template <', 'public:', 'private:', 'endl;'
    ]
  };

  let counts = { javascript: 0, python: 0, cpp: 0 };
  
  for (const [lang, ps] of Object.entries(patterns)) {
    ps.forEach(p => {
      if (c.includes(p.toLowerCase())) counts[lang]++;
    });
  }

  const maxVal = Math.max(...Object.values(counts));
  if (maxVal === 0) return null;
  
  return Object.keys(counts).find(lang => counts[lang] === maxVal);
};

module.exports = { detectLanguage };
