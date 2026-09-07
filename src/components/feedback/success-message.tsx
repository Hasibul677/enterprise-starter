import { Alert } from "./alert";

export function SuccessMessage({ children }: { children: React.ReactNode }) {
  return <Alert variant="success">{children}</Alert>;
}
