import Dashboard from "./DeveloperDashboard";
import addStyle from "roamjs-components/dom/addStyle";
import runExtension from "roamjs-components/util/runExtension";
import { runService } from "roamjs-components/components/ServiceComponents";

addStyle(`.roamjs-developer-path {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 16px;
  border-radius: 4px;
}

.roamjs-developer-path:hover {
  background-color: #eeeeee;
}`);

const ID = "developer";
runExtension(ID, () => {
  runService({
    id: ID,
    Dashboard,
  });
});
