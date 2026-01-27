import { useState, useMemo } from "react";
import { Wildcard } from "@/types/schema";
import yaml from "js-yaml";

interface WildcardBrowserListsProps {
  wildcard: Wildcard;
  currentPath?: string;
  onSelectValue: (path: string, value: string) => void;
}

interface TreeNode {
  key: string;
  value: unknown;
  isLeaf: boolean;
  path?: string;
  children?: TreeNode[];
}

export function WildcardBrowserLists({
  wildcard,
  currentPath,
  onSelectValue,
}: WildcardBrowserListsProps) {
  // Parse the current path to initialize navigation
  const parsePathToNavigation = (path: string): string[] => {
    if (!path) return [];

    const parts: string[] = [];
    let current = "";
    let inBracket = false;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === "[") {
        if (current) {
          parts.push(current);
          current = "";
        }
        inBracket = true;
        current = "[";
      } else if (char === "]") {
        current += "]";
        parts.push(current);
        current = "";
        inBracket = false;
      } else if (char === "." && !inBracket) {
        if (current) {
          parts.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  };

  const [navigationPath, setNavigationPath] = useState<string[]>(() =>
    parsePathToNavigation(currentPath || ""),
  );

  const buildTree = useMemo(() => {
    const buildPathLocal = (pathArray: string[]): string => {
      let result = "";
      pathArray.forEach((segment, idx) => {
        if (segment.startsWith("[")) {
          result += segment;
        } else if (idx === 0) {
          result += segment;
        } else {
          result += `.${segment}`;
        }
      });
      return result;
    };

    const buildTreeRecursive = (
      obj: unknown,
      parentPath: string[] = [],
    ): TreeNode[] => {
      if (Array.isArray(obj)) {
        return obj.map((item, idx) => {
          const currentPath = [...parentPath, `[${idx}]`];
          if (
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean"
          ) {
            return {
              key: String(item),
              value: String(item),
              isLeaf: true,
              path: buildPathLocal(currentPath),
            };
          } else {
            return {
              key: `[${idx}]`,
              value: item,
              isLeaf: false,
              children: buildTreeRecursive(item, currentPath),
              path: buildPathLocal(currentPath),
            };
          }
        });
      } else if (typeof obj === "object" && obj !== null) {
        const record = obj as Record<string, unknown>;
        return Object.keys(record).map((key) => {
          const value = record[key];
          const currentPath = [...parentPath, key];

          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            return {
              key,
              value: String(value),
              isLeaf: true,
              path: buildPathLocal(currentPath),
            };
          } else {
            return {
              key,
              value,
              isLeaf: false,
              children: buildTreeRecursive(value, currentPath),
            };
          }
        });
      }
      return [];
    };
    return buildTreeRecursive;
  }, []);

  const tree: TreeNode[] = useMemo(() => {
    try {
      let data: unknown;
      switch (wildcard.format) {
        case "json":
          data = JSON.parse(wildcard.content);
          break;
        case "yaml":
          data = yaml.load(wildcard.content);
          break;
        case "lines": {
          const lines = wildcard.content.split("\n").filter((l) => l.trim());
          return lines.map((line, idx) => ({
            key: `line ${idx + 1}`,
            value: line,
            isLeaf: true,
            path: `[${idx}]`,
          }));
        }
        case "text":
          return [
            {
              key: "text",
              value: wildcard.content,
              isLeaf: true,
              path: "",
            },
          ];
        default:
          console.warn("Unknown wildcard format:", wildcard.format);
          return [];
      }

      const result = buildTree(data);

      return result;
    } catch (error) {
      console.error("Error building wildcard tree:", error);
      return [];
    }
  }, [wildcard, buildTree]);

  const handleNavigate = (
    key: string,
    isLeaf: boolean,
    path: string,
    value: unknown,
    levelIndex: number,
  ) => {
    if (isLeaf) {
      onSelectValue(path, String(value));
    } else {
      // Update navigation path up to this level, then add the new selection
      const newPath = navigationPath.slice(0, levelIndex);
      newPath.push(key);
      setNavigationPath(newPath);
    }
  };

  const levels: TreeNode[][] = [];

  // Build all levels based on navigation path
  let currentNodes = tree;
  levels.push(currentNodes);

  for (const key of navigationPath) {
    const node = currentNodes.find((n) => n.key === key);
    if (node && node.children) {
      currentNodes = node.children;
      levels.push(currentNodes);
    }
  }

  if (tree.length === 0) {
    return (
      <div className="text-xs text-cyan-medium italic">
        No values found in wildcard
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {levels.map((levelNodes, levelIndex) => {
        const selectedKey = navigationPath[levelIndex];

        return (
          <div key={levelIndex}>
            {levelIndex > 0 && (
              <hr className="border-t border-cyan-medium my-3" />
            )}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {levelNodes.map((node, idx) => {
                const isSelected = node.key === selectedKey;
                return (
                  <button
                    key={idx}
                    onClick={() =>
                      handleNavigate(
                        node.key,
                        node.isLeaf,
                        node.path || "",
                        node.value,
                        levelIndex,
                      )
                    }
                    className={`flex-shrink-0 px-3 py-2 rounded border text-sm ${
                      node.isLeaf
                        ? "bg-magenta-dark/10 border-magenta-medium/30 hover:bg-magenta-dark/20"
                        : isSelected
                          ? "bg-magenta-dark/20 border-magenta-medium/50 hover:bg-magenta-dark/30"
                          : "bg-cyan-dark border-cyan-medium hover:bg-cyan-dark/80"
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-medium">
                        {node.isLeaf ? String(node.value) : node.key}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
