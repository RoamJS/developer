import Dashboard from "./DeveloperDashboard";
import addStyle from "roamjs-components/dom/addStyle";
import runExtension from "roamjs-components/util/runExtension";
import { runService } from "roamjs-components/components/ServiceComponents";

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
