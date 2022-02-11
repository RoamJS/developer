import { Button, Intent, Spinner, SpinnerSize } from "@blueprintjs/core";
import axios from "axios";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import getFirstChildTextByBlockUid from "roamjs-components/queries/getFirstChildTextByBlockUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import getCurrentUserEmail from "roamjs-components/queries/getCurrentUserEmail";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageSet from "roamjs-components/util/localStorageSet";
import toFlexRegex from "roamjs-components/util/toFlexRegex";

const width = 600;
const height = 525;
const StripePanel = ({ parentUid }: { uid?: string; parentUid: string }) => {
  const [connected, setConnected] = useState(!!localStorageGet("stripe"));
  const [showRetry, setShowRetry] = useState(false);
  const token = useMemo(() => {
    const localToken = localStorageGet("token-developer");
    if (localToken) {
      return localToken;
    }
    const tokenUid = getShallowTreeByParentUid(parentUid).find((t) =>
      toFlexRegex("token").test(t.text)
    )?.uid;
    return getFirstChildTextByBlockUid(tokenUid);
  }, [parentUid]);
  const opts = useMemo(() => ({ headers: { Authorization: token } }), [token]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const intervalListener = useRef(0);
  const pollStripeAccount = useCallback(() => {
    intervalListener.current = 0;
    const connectInterval = () => {
      axios
        .post(
          `https://lambda.roamjs.com/stripe-account`,
          {
            operation: "FINISH",
            email: getCurrentUserEmail(),
            dev: process.env.NODE_ENV === "development",
          },
          opts
        )
        .then((r) => {
          if (r.data.done) {
            setConnected(true);
            localStorageSet("stripe", "true");
            setShowRetry(false);
            setLoading(false);
            window.clearTimeout(intervalListener.current);
          } else {
            setShowRetry(true);
            intervalListener.current = window.setTimeout(connectInterval, 1000);
          }
        })
        .catch((e) => {
          if (e.response?.status !== 409) {
            intervalListener.current = window.setTimeout(connectInterval, 1000);
          } else {
            setLoading(false);
          }
          setShowRetry(false);
        });
    };
    setLoading(true);
    connectInterval();
  }, [setConnected, setLoading, opts, setShowRetry]);
  const stripeConnectOnClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (loading) {
        return;
      }
      setError("");
      setLoading(true);
      axios
        .post(
          `https://lambda.roamjs.com/stripe-account`,
          {
            operation: "CREATE",
            email: getCurrentUserEmail(),
            dev: process.env.NODE_ENV === "development",
          },
          opts
        )
        .then((r) => {
          const left = window.screenX + (window.innerWidth - width) / 2;
          const top = window.screenY + (window.innerHeight - height) / 2;
          window.open(
            r.data.url,
            `roamjs:stripe:connect`,
            `left=${left},top=${top},width=${width},height=${height},status=1`
          );
          pollStripeAccount();
        })
        .catch((e) => {
          setError(e.response?.data || e.message);
          setLoading(false);
        });
    },
    [setLoading, setError, loading, pollStripeAccount, opts]
  );
  const stripeRetryOnClick = useCallback(
    () =>
      axios
        .post(
          "https://lambda.roamjs.com/stripe-account",
          {
            operation: "RETRY",
            email: getCurrentUserEmail(),
            dev: process.env.NODE_ENV === "development",
          },
          opts
        )
        .then((r) => {
          const left = window.screenX + (window.innerWidth - width) / 2;
          const top = window.screenY + (window.innerHeight - height) / 2;
          window.open(
            r.data.url,
            `roamjs:stripe:connect`,
            `left=${left},top=${top},width=${width},height=${height},status=1`
          );
        })
        .catch((e) => {
          setError(e.response?.data || e.message);
          setShowRetry(false);
        }),
    [setError, opts, setShowRetry]
  );
  useEffect(() => {
    if (!connected && token) {
      pollStripeAccount();
    }
    return () => window.clearTimeout(intervalListener.current);
  }, [connected, token, pollStripeAccount, intervalListener]);
  return (
    <>
      <style>
        {`/* https://stripe.com/docs/connect/collect-then-transfer-guide#create-account */
a.stripe-connect {
  background: #635bff;
  display: inline-block;
  height: 38px;
  text-decoration: none;
  width: 420px;

  border-radius: 4px;
  -moz-border-radius: 4px;
  -webkit-border-radius: 4px;

  user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;

  -webkit-font-smoothing: antialiased;
}

a.stripe-connect span {
  color: #ffffff;
  display: block;
  font-family: sohne-var, "Helvetica Neue", Arial, sans-serif;
  font-size: 15px;
  font-weight: 400;
  line-height: 14px;
  padding: 11px 0px 0px 24px;
  position: relative;
  text-align: left;
}

a.stripe-connect:hover {
  background: #7a73ff;
}

a.stripe-connect.disabled {
  background: #7a73ff;
  cursor: not-allowed;
}

.stripe-connect span::after {
  background-repeat: no-repeat;
  background-size: 49.58px;
  content: "";
  height: 20px;
  left: 62%;
  position: absolute;
  top: 28.95%;
  width: 49.58px;
}

/* Logos */
.stripe-connect span::after {
  background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!-- Generator: Adobe Illustrator 23.0.4, SVG Export Plug-In . SVG Version: 6.00 Build 0) --%3E%3Csvg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 468 222.5' style='enable-background:new 0 0 468 222.5;' xml:space='preserve'%3E%3Cstyle type='text/css'%3E .st0%7Bfill-rule:evenodd;clip-rule:evenodd;fill:%23FFFFFF;%7D%0A%3C/style%3E%3Cg%3E%3Cpath class='st0' d='M414,113.4c0-25.6-12.4-45.8-36.1-45.8c-23.8,0-38.2,20.2-38.2,45.6c0,30.1,17,45.3,41.4,45.3 c11.9,0,20.9-2.7,27.7-6.5v-20c-6.8,3.4-14.6,5.5-24.5,5.5c-9.7,0-18.3-3.4-19.4-15.2h48.9C413.8,121,414,115.8,414,113.4z M364.6,103.9c0-11.3,6.9-16,13.2-16c6.1,0,12.6,4.7,12.6,16H364.6z'/%3E%3Cpath class='st0' d='M301.1,67.6c-9.8,0-16.1,4.6-19.6,7.8l-1.3-6.2h-22v116.6l25-5.3l0.1-28.3c3.6,2.6,8.9,6.3,17.7,6.3 c17.9,0,34.2-14.4,34.2-46.1C335.1,83.4,318.6,67.6,301.1,67.6z M295.1,136.5c-5.9,0-9.4-2.1-11.8-4.7l-0.1-37.1 c2.6-2.9,6.2-4.9,11.9-4.9c9.1,0,15.4,10.2,15.4,23.3C310.5,126.5,304.3,136.5,295.1,136.5z'/%3E%3Cpolygon class='st0' points='223.8,61.7 248.9,56.3 248.9,36 223.8,41.3 '/%3E%3Crect x='223.8' y='69.3' class='st0' width='25.1' height='87.5'/%3E%3Cpath class='st0' d='M196.9,76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7,15.9-6.3,19-5.2v-23C214.5,68.1,202.8,65.9,196.9,76.7z'/%3E%3Cpath class='st0' d='M146.9,47.6l-24.4,5.2l-0.1,80.1c0,14.8,11.1,25.7,25.9,25.7c8.2,0,14.2-1.5,17.5-3.3V135 c-3.2,1.3-19,5.9-19-8.9V90.6h19V69.3h-19L146.9,47.6z'/%3E%3Cpath class='st0' d='M79.3,94.7c0-3.9,3.2-5.4,8.5-5.4c7.6,0,17.2,2.3,24.8,6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6 C67.5,67.6,54,78.2,54,95.9c0,27.6,38,23.2,38,35.1c0,4.6-4,6.1-9.6,6.1c-8.3,0-18.9-3.4-27.3-8v23.8c9.3,4,18.7,5.7,27.3,5.7 c20.8,0,35.1-10.3,35.1-28.2C117.4,100.6,79.3,105.9,79.3,94.7z'/%3E%3C/g%3E%3C/svg%3E");
}

/* https://stripe.com/docs/connect/collect-then-transfer-guide?platform=web#accept-payment */
.StripeElement {
  height: 40px;
  padding: 10px 12px;
  width: 100%;
  color: #32325d;
  background-color: white;
  border: 1px solid transparent;
  border-radius: 4px;
  box-shadow: 0 1px 3px 0 #e6ebf1;
  -webkit-transition: box-shadow 150ms ease;
  transition: box-shadow 150ms ease;
}
.StripeElement--focus {
  box-shadow: 0 1px 3px 0 #cfd7df;
}
.StripeElement--invalid {
  border-color: #fa755a;
}
.StripeElement--webkit-autofill {
  background-color: #fefde5 !important;
}`}
      </style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 16,
        }}
      >
        {!token ? (
          <span>Must first generate a token to connect with Stripe</span>
        ) : !connected ? (
          <>
            <a
              href="#"
              className={`stripe-connect${loading ? " disabled" : ""}`}
              onClick={stripeConnectOnClick}
            >
              <span>Connect with</span>
            </a>
            {showRetry && (
              <div style={{ marginTop: 8 }}>
                <p>
                  If your country is not currently supported, reach out to
                  support@roamjs.com to inquire about supporting your country.
                </p>
                <p>
                  If you close out of the Stripe window, feel free to try again
                  here:
                </p>
                <Button
                  intent={Intent.WARNING}
                  text={"Retry"}
                  onClick={stripeRetryOnClick}
                />
              </div>
            )}
          </>
        ) : (
          <span>Connected with Stripe</span>
        )}
        <span style={{ display: "inline-block", minWidth: 30 }}>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
        </span>
      </div>
      <div style={{ color: "darkred" }}>{error}</div>
    </>
  );
};

export default StripePanel;
