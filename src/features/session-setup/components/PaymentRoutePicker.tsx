import { Link } from "react-router-dom";
import { Choice, Icon, Panel } from "@/ui";
import type { PaymentRoute } from "@/shared/types";

interface Props {
  /* What the Session will run on — either what was chosen here or, until
     something is chosen, what the Key Vault already implies. */
  route: PaymentRoute;
  hasKey: boolean;
  fingerprint?: string;
  onChange: (route: PaymentRoute) => void;
}

/* Who pays, asked once and fixed for the Session.
 *
 * The two routes send different keys: on Credits the call goes out on ours and
 * the cents land on the ledger; on BYOK it goes out on the Candidate's and the
 * ledger records nothing. So a Candidate holding a key may still choose
 * Credits, and the server obeys it — the one thing it refuses is BYOK with no
 * key to spend, which is why that option is offered disabled rather than hidden.
 */
export function PaymentRoutePicker({ route, hasKey, fingerprint, onChange }: Props) {
  return (
    <>
      <div className="grid-2" role="radiogroup" aria-labelledby="step-pays">
        <Choice
          name="payment-route"
          value="credits"
          checked={route === "credits"}
          onChange={() => onChange("credits")}
          title="Let us handle it"
          sub="Runs on our key. One Credit is one US cent of Provider cost, metered per graded call."
        />
        <Choice
          name="payment-route"
          value="byok"
          checked={route === "byok"}
          onChange={() => onChange("byok")}
          disabled={!hasKey}
          title="Use my own key"
          sub={
            hasKey
              ? `Your OpenRouter key ${fingerprint ?? ""} · your Provider bills you directly.`.trim()
              : "No key attached yet. Attach one in Credits and this becomes available."
          }
        />
      </div>
      {hasKey ? null : (
        <p className="caption mt-4">
          <Link to="/credits">Attach an OpenRouter key</Link> to run a Session on your own account.
        </p>
      )}
      <Panel tone="2" pad={6} className="mt-6 rule-note">
        <Icon name="ledger" size={16} />
        <p className="body-sm dim" style={{ margin: 0 }}>
          Choosing Credits with a key attached spends nothing on your Provider — the key is left unused rather
          than billed twice. Either way, a Session's cost is not knowable in advance: it is metered per graded
          call and reported after each Topic.
        </p>
      </Panel>
    </>
  );
}
