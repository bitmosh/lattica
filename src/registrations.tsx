import { registerPayloadRenderer } from "./control-plane/payload-renderer/payloadRendererRegistry";
import { tileSectionRegistry } from "./control-plane/tile-section/tileSectionRegistry";
import { SignalEvaluatedRenderer } from "./renderers/cerebra/SignalEvaluatedRenderer";
import { CerebraSignalTile } from "./tiles/cerebra-signal/CerebraSignalTile";

registerPayloadRenderer({
  project: "cerebra",
  event_type: "SignalEvaluated",
  component: SignalEvaluatedRenderer,
  label: "Cerebra — Signal Evaluated",
  stream_glob: "cerebra/agent-trace/*",
});

tileSectionRegistry.register({
  id: "cerebra-signal-feed",
  label: "Cerebra Signal Feed",
  category: "right-panel",
  defaultWidth: 420,
  defaultHeight: 320,
  collapsible: true,
  defaultAnchor: { edge: "right", offset: 0 },
  defaultVisible: true,
  defaultExpanded: true,
  content: () => <CerebraSignalTile />,
});
