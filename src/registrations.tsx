import { registerPayloadRenderer } from "./control-plane/payload-renderer/payloadRendererRegistry";
import { tileSectionRegistry } from "./control-plane/tile-section/tileSectionRegistry";
import { SignalEvaluatedRenderer } from "./renderers/cerebra/SignalEvaluatedRenderer";
import { PredictionMadeRenderer } from "./renderers/cerebra/PredictionMadeRenderer";
import { OutcomeRecordedRenderer } from "./renderers/cerebra/OutcomeRecordedRenderer";
import { ClutchDecisionMadeRenderer } from "./renderers/cerebra/ClutchDecisionMadeRenderer";
import { CerebraSignalTile } from "./tiles/cerebra-signal/CerebraSignalTile";

registerPayloadRenderer({
  project: "cerebra",
  event_type: "SignalEvaluated",
  component: SignalEvaluatedRenderer,
  label: "Cerebra — Signal Evaluated",
  stream_glob: "cerebra/agent-trace/*",
});

registerPayloadRenderer({
  project: "cerebra",
  event_type: "PredictionMade",
  component: PredictionMadeRenderer,
  label: "Cerebra — Prediction Made",
  stream_glob: "cerebra/agent-trace/*",
});

registerPayloadRenderer({
  project: "cerebra",
  event_type: "OutcomeRecorded",
  component: OutcomeRecordedRenderer,
  label: "Cerebra — Outcome Recorded",
  stream_glob: "cerebra/agent-trace/*",
});

registerPayloadRenderer({
  project: "cerebra",
  event_type: "ClutchDecisionMade",
  component: ClutchDecisionMadeRenderer,
  label: "Cerebra — Clutch Decision Made",
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
