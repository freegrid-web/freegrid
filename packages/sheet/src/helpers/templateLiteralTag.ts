/**
 * Template literal tag that joins a multi-line template into one line: line breaks and the indentation after them
 * are removed, and the result is trimmed. Falsy expressions are left out.
 */
export const toSingleLine = (strings: TemplateStringsArray | readonly string[], ...expressions: unknown[]): string => {
  const result = strings.reduce((previousValue: string, currentValue: string, index: number) => {
    const valueWithoutWhiteSpaces = currentValue.replace(/(?:\r?\n\s+)/g, '');
    const expressionForIndex = expressions[index] ? expressions[index] : '';

    return previousValue + valueWithoutWhiteSpaces + expressionForIndex;
  }, '');

  return result.trim();
};
