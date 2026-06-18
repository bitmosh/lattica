import { registerPayloadRenderer } from "./control-plane/payload-renderer/payloadRendererRegistry";
import { tileSectionRegistry } from "./control-plane/tile-section/tileSectionRegistry";
import { StepStartedRenderer } from "./renderers/cerebra/StepStartedRenderer";
import { SignalEvaluatedRenderer } from "./renderers/cerebra/SignalEvaluatedRenderer";
import { PredictionMadeRenderer } from "./renderers/cerebra/PredictionMadeRenderer";
import { OutcomeRecordedRenderer } from "./renderers/cerebra/OutcomeRecordedRenderer";
import { ClutchDecisionMadeRenderer } from "./renderers/cerebra/ClutchDecisionMadeRenderer";
import { CheckpointSavedRenderer } from "./renderers/cerebra/CheckpointSavedRenderer";
import { CerebraSignalTile } from "./tiles/cerebra-signal/CerebraSignalTile";
import { AiStackTopologyTile } from "./tiles/ai-stack/AiStackTopologyTile";
import { PolicyScoutTile } from "./tiles/policy-scout/PolicyScoutTile";
import { LumaWeaveTile } from "./tiles/lumaweave/LumaWeaveTile";
import { FossicTile } from "./tiles/fossic/FossicTile";
import { DecisionIssuedRenderer } from "./renderers/policy-scout/DecisionIssuedRenderer";
import { ApprovalRequestedRenderer } from "./renderers/policy-scout/ApprovalRequestedRenderer";
import { LockdownActivatedRenderer } from "./renderers/policy-scout/LockdownActivatedRenderer";
import { LockdownDeactivatedRenderer } from "./renderers/policy-scout/LockdownDeactivatedRenderer";

registerPayloadRenderer({
  project: "cerebra",
  event_type: "StepStarted",
  component: StepStartedRenderer,
  label: "Cerebra — Step Started",
  stream_glob: "cerebra/agent-trace/*",
});

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

registerPayloadRenderer({
  project: "cerebra",
  event_type: "CheckpointSaved",
  component: CheckpointSavedRenderer,
  label: "Cerebra — Checkpoint Saved",
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

tileSectionRegistry.register({
  id: "ai-stack-topology",
  label: "AI Stack Topology",
  category: "right-panel",
  defaultWidth: 480,
  defaultHeight: 520,
  collapsible: true,
  defaultAnchor: { edge: "right" },
  defaultVisible: true,
  defaultExpanded: true,
  content: () => <AiStackTopologyTile />,
});

// PHASE 2 — uncomment when ai-stack-relay.py is running live
// import { VramBudgetChangedRenderer } from "./renderers/ai-stack/VramBudgetChangedRenderer";
// import { ModelLoadedRenderer } from "./renderers/ai-stack/ModelLoadedRenderer";
// import { ModelUnloadedRenderer } from "./renderers/ai-stack/ModelUnloadedRenderer";
// import { SidecarStartedRenderer } from "./renderers/ai-stack/SidecarStartedRenderer";
// import { SidecarStoppedRenderer } from "./renderers/ai-stack/SidecarStoppedRenderer";
//
// registerPayloadRenderer({
//   project: "ai-stack",
//   event_type: "VramBudgetChanged",
//   component: VramBudgetChangedRenderer,
//   label: "ai-stack — VRAM Budget Changed",
//   stream_glob: "ai-stack/gpu",
// });
// registerPayloadRenderer({
//   project: "ai-stack",
//   event_type: "ModelLoaded",
//   component: ModelLoadedRenderer,
//   label: "ai-stack — Model Loaded",
//   stream_glob: "ai-stack/models",
// });
// registerPayloadRenderer({
//   project: "ai-stack",
//   event_type: "ModelUnloaded",
//   component: ModelUnloadedRenderer,
//   label: "ai-stack — Model Unloaded",
//   stream_glob: "ai-stack/models",
// });
// registerPayloadRenderer({
//   project: "ai-stack",
//   event_type: "SidecarStarted",
//   component: SidecarStartedRenderer,
//   label: "ai-stack — Sidecar Started",
//   stream_glob: "ai-stack/lifecycle",
// });
// registerPayloadRenderer({
//   project: "ai-stack",
//   event_type: "SidecarStopped",
//   component: SidecarStoppedRenderer,
//   label: "ai-stack — Sidecar Stopped",
//   stream_glob: "ai-stack/lifecycle",
// });

tileSectionRegistry.register({
  id: "policy-scout-governance",
  label: "Policy Scout",
  category: "right-panel",
  defaultWidth: 440,
  defaultHeight: 480,
  collapsible: true,
  defaultAnchor: { edge: "right" },
  defaultVisible: true,
  defaultExpanded: true,
  content: () => <PolicyScoutTile />,
});

// NOTE (B4): Pane.tsx is authoritative for workspace tile routing. The registry
// entries above are retained for the LumaWeave floating tile system (FloatingTile
// path) and future compositor use. Pane.tsx routes by TileKey directly and does
// NOT call registry.content().
tileSectionRegistry.register({
  id: "lumaweave-graph",
  label: "LumaWeave Graph",
  category: "right-panel",
  defaultWidth: 480,
  defaultHeight: 520,
  collapsible: true,
  defaultVisible: true,
  defaultExpanded: true,
  content: () => <LumaWeaveTile />,
});

tileSectionRegistry.register({
  id: "fossic-stream-view",
  label: "Fossic Stream View",
  category: "right-panel",
  defaultWidth: 560,
  defaultHeight: 480,
  collapsible: true,
  defaultVisible: false,
  defaultExpanded: true,
  content: () => <FossicTile />,
});

registerPayloadRenderer({
  project: "policy-scout",
  event_type: "DecisionIssued",
  component: DecisionIssuedRenderer,
  label: "Policy Scout — Decision Issued",
  stream_glob: "policy-scout/audit/**",
});

registerPayloadRenderer({
  project: "policy-scout",
  event_type: "ApprovalRequested",
  component: ApprovalRequestedRenderer,
  label: "Policy Scout — Approval Requested",
  stream_glob: "policy-scout/audit/**",
});

registerPayloadRenderer({
  project: "policy-scout",
  event_type: "LockdownActivated",
  component: LockdownActivatedRenderer,
  label: "Policy Scout — Lockdown Activated",
  stream_glob: "policy-scout/posture",
});

registerPayloadRenderer({
  project: "policy-scout",
  event_type: "LockdownDeactivated",
  component: LockdownDeactivatedRenderer,
  label: "Policy Scout — Lockdown Deactivated",
  stream_glob: "policy-scout/posture",
});
