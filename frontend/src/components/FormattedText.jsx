import React from 'react';

const FormattedText = ({ text, className = "" }) => {
  if (!text) return null;

  const parseText = (rawText) => {
    // Protect math blocks from being formatted: \(...\), \[...\], $$...$$
    const mathBlocks = [];
    let processed = rawText.replace(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$)/g, (match) => {
      mathBlocks.push(match);
      return `__MATH_BLOCK_${mathBlocks.length - 1}__`;
    });

    // Handle legacy Markdown formatting if HTML tags aren't present
    const hasHtml = /<[a-z][\s\S]*>/i.test(processed);
    if (!hasHtml) {
      processed = processed
        .replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>')
        .replace(/\*([\s\S]*?)\*/g, '<i>$1</i>')
        .replace(/\n/g, '<br/>');
    }

    // Restore math blocks
    mathBlocks.forEach((block, index) => {
      processed = processed.replace(`__MATH_BLOCK_${index}__`, block);
    });

    return processed;
  };

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: parseText(text) }} 
    />
  );
};

export default FormattedText;
