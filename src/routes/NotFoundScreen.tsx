import { useLocation } from "react-router-dom";
import { PageHeader, Workbench } from "@/shared/components";
import { ButtonLink, EmptyState } from "@/ui";

export function NotFoundScreen() {
  const { pathname } = useLocation();
  return (
    <>
      <PageHeader title="Not here" />
      <Workbench stage>
        <EmptyState
          icon="probe"
          title={`There is nothing at ${pathname}`}
          body="The screens are Notebook, Session, Examination, Mastery and Evidence — plus Credits and Settings."
          action={
            <span className="row g-4">
              <ButtonLink to="/mastery" variant="primary">Mastery map</ButtonLink>
              <ButtonLink to="/session/new" variant="ghost">Start a Session</ButtonLink>
            </span>
          }
        />
      </Workbench>
    </>
  );
}
