import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { LENGTH_LIMITS } from "@shared/limits";

interface WildcardContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  format: string;
  disabled?: boolean;
}

export function WildcardContentEditor({
  value,
  onChange,
  format,
  disabled,
}: WildcardContentEditorProps) {
  const getExtensions = () => {
    switch (format) {
      case "json":
        return [json()];
      case "yaml":
        return [yaml()];
      default:
        return [];
    }
  };

  return (
    <CodeMirror
      value={value}
      height="300px"
      theme={vscodeDark}
      extensions={getExtensions()}
      onChange={(val) => {
        if (val.length <= LENGTH_LIMITS.wildcardContent) {
          onChange(val);
        }
      }}
      editable={!disabled}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        foldGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        highlightActiveLine: true,
      }}
      className="border border-cyan-medium rounded-md overflow-hidden"
    />
  );
}
