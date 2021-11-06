import { toConfig, runExtension } from "roam-client";
import { createConfigObserver } from "roamjs-components";

const ID = "developer";
const CONFIG = toConfig(ID);
runExtension(ID, () => {
  createConfigObserver({ title: CONFIG, config: { tabs: [] } });
});
