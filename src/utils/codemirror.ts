import { autocompletion, completeFromList } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";

type CompletionType = "keyword" | "property";
type EditorScene = "trade" | "json-template";

const completionWords: Record<
  EditorScene,
  { words: string[]; type: CompletionType }
> = {
  trade: {
    type: "keyword",
    words: [
      "let",
      "trim",
      "upper",
      "lower",
      "split",
      "replace",
      "repeat",
      "indexOf",
      "hasPrefix",
      "now",
      "max",
      "min",
      "abs",
      "ceil",
      "floor",
      "round",
      "all",
      "any",
      "one",
      "none",
      "map",
      "filter",
      "find",
      "findIndex",
      "findLast",
      "groupBy",
      "count",
      "concat",
      "join",
      "reduce",
      "sum",
      "mean",
      "median",
      "first",
      "last",
      "take",
      "reverse",
      "sort",
      "sortBy",
      "keys",
      "values",
      "len"
    ]
  },
  "json-template": {
    type: "property",
    words: [
      "name",
      "type",
      "code",
      "enable",
      "long",
      "short",
      "kline_base",
      "kline_kc",
      "custom",
      "technology",
      "strategy"
    ]
  }
};

export const codeMirrorBasicSetup = {
  lineNumbers: true,
  foldGutter: true,
  highlightActiveLine: true,
  bracketMatching: true,
  closeBrackets: true,
  autocompletion: true,
  searchKeymap: true,
  history: true,
  highlightSelectionMatches: true,
  lineWrapping: true
};

function buildCompletion(scene: EditorScene) {
  const sceneCompletion = completionWords[scene];
  return autocompletion({
    override: [
      completeFromList(
        sceneCompletion.words.map(item => ({
          label: item,
          type: sceneCompletion.type
        }))
      )
    ]
  });
}

export function buildTradeEditorExtensions() {
  return [
    javascript(),
    oneDark,
    keymap.of([indentWithTab]),
    buildCompletion("trade")
  ];
}

export function buildTemplateJsonEditorExtensions() {
  return [
    json(),
    oneDark,
    keymap.of([indentWithTab]),
    buildCompletion("json-template")
  ];
}
