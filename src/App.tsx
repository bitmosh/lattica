// SPDX-License-Identifier: Apache-2.0
import { Shell } from './components/workspace/Shell';
import { PaneWorkspace } from './components/workspace/PaneWorkspace';

export default function App() {
  return (
    <Shell>
      <PaneWorkspace />
    </Shell>
  );
}
