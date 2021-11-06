import Dashboard from "./DeveloperDashboard";
import { addStyle,toConfig, runExtension } from "roam-client";
import { createConfigObserver, runService } from "roamjs-components";

addStyle(`.roamjs-developer-path:hover {
  background-color: #dddddd;
}`);

const ID = "developer";
runExtension(ID, () => {
  runService({
    id: ID,
    Dashboard,
  });
});
