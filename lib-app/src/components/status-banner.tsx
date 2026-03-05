type StatusBannerProps = {
  type?: string;
  message?: string;
};

export function StatusBanner({ type, message }: StatusBannerProps) {
  if (!message) {
    return null;
  }

  const className =
    type === "error" ? "status-banner status-banner--error" : "status-banner";

  return <p className={className}>{message}</p>;
}
