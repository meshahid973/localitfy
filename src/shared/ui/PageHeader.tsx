import type { ReactNode } from "react";
import "./page-header.css";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
};

/** Page title row shared by the browse views, matching the Library header. */
export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <header className="pageHeader">
      <div className="pageHeaderHeading">
        {eyebrow ? <p className="pageHeaderEyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="pageHeaderDescription">{description}</p> : null}
      </div>
      {children ? <div className="pageHeaderTools">{children}</div> : null}
    </header>
  );
}
