import yaml from "js-yaml";

export interface WildcardValue {
  path: string;
  value: string;
  displayPath: string;
}

const MAX_DEPTH = 3;

function buildPath(keys: (string | number)[]): string {
  if (keys.length === 0) return "";

  let path = "";
  keys.forEach((key, index) => {
    if (typeof key === "number") {
      path += `[${key}]`;
    } else if (index === 0) {
      path += key;
    } else {
      path += `.${key}`;
    }
  });
  return path;
}

function extractValuesFromObject(
  obj: unknown,
  currentPath: (string | number)[] = [],
  depth: number = 0,
): WildcardValue[] {
  if (depth >= MAX_DEPTH) {
    // At max depth, treat as leaf value
    const value = typeof obj === "string" ? obj : JSON.stringify(obj);
    return [
      {
        path: buildPath(currentPath),
        value,
        displayPath: buildPath(currentPath),
      },
    ];
  }

  const values: WildcardValue[] = [];

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      if (typeof item === "string") {
        values.push({
          path: buildPath([...currentPath, index]),
          value: item,
          displayPath: buildPath([...currentPath, index]),
        });
      } else if (typeof item === "object" && item !== null) {
        values.push(
          ...extractValuesFromObject(item, [...currentPath, index], depth + 1),
        );
      } else {
        // Numbers, booleans, etc - convert to string
        values.push({
          path: buildPath([...currentPath, index]),
          value: String(item),
          displayPath: buildPath([...currentPath, index]),
        });
      }
    });
  } else if (typeof obj === "object" && obj !== null) {
    const record = obj as Record<string, unknown>;
    Object.keys(record).forEach((key) => {
      const value = record[key];
      if (typeof value === "string") {
        values.push({
          path: buildPath([...currentPath, key]),
          value: value,
          displayPath: buildPath([...currentPath, key]),
        });
      } else if (
        Array.isArray(value) ||
        (typeof value === "object" && value !== null)
      ) {
        values.push(
          ...extractValuesFromObject(value, [...currentPath, key], depth + 1),
        );
      } else {
        // Numbers, booleans, etc
        values.push({
          path: buildPath([...currentPath, key]),
          value: String(value),
          displayPath: buildPath([...currentPath, key]),
        });
      }
    });
  } else if (typeof obj === "string") {
    values.push({
      path: buildPath(currentPath),
      value: obj,
      displayPath: buildPath(currentPath),
    });
  }

  return values;
}

export function extractWildcardValues(
  content: string,
  format: string,
): WildcardValue[] {
  try {
    switch (format) {
      case "json": {
        const jsonData = JSON.parse(content);
        return extractValuesFromObject(jsonData);
      }

      case "yaml": {
        const yamlData = yaml.load(content);
        return extractValuesFromObject(yamlData);
      }

      case "lines": {
        const lines = content.split("\n").filter((l) => l.trim());
        return lines.map((line, index) => ({
          path: `[${index}]`,
          value: line.trim(),
          displayPath: `line ${index + 1}`,
        }));
      }

      case "text":
        return [
          {
            path: "",
            value: content,
            displayPath: "(full text)",
          },
        ];

      default:
        return [
          {
            path: "",
            value: content,
            displayPath: "(content)",
          },
        ];
    }
  } catch {
    return [];
  }
}

export function resolveWildcardPath(
  content: string,
  format: string,
  path: string,
): string | null {
  try {
    if (!path) {
      return format === "text" ? content : null;
    }

    switch (format) {
      case "json": {
        const jsonData = JSON.parse(content);
        return resolvePath(jsonData, path);
      }

      case "yaml": {
        const yamlData = yaml.load(content);
        return resolvePath(yamlData, path);
      }

      case "lines": {
        const lines = content.split("\n").filter((l) => l.trim());
        const match = path.match(/\[(\d+)\]/);
        if (match) {
          const index = parseInt(match[1]);
          return lines[index] || null;
        }
        return null;
      }

      case "text":
        return content;

      default:
        return content;
    }
  } catch {
    return null;
  }
}

function resolvePath(obj: unknown, path: string): string | null {
  // Parse path like "landscape.geography.minerals[1]"
  const tokens: (string | number)[] = [];

  // Split on dots and brackets
  const parts = path.split(/\.|\[/).map((p) => p.replace(/\]$/, ""));

  parts.forEach((part) => {
    if (!part) return;

    if (/^\d+$/.test(part)) {
      tokens.push(Number(part));
    } else {
      tokens.push(part);
    }
  });

  let current: unknown = obj;
  for (const token of tokens) {
    if (current === undefined || current === null) {
      return null;
    }

    current = (current as Record<string | number, unknown>)[token];
  }

  if (current === undefined || current === null) {
    return null;
  }

  return typeof current === "string" ? current : JSON.stringify(current);
}
