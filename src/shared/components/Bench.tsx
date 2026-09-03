import type { ReactNode } from "react";

/* Three columns that scroll independently, inside a frame that does not.
 *
 * Not a third slot on `Workbench`: that one scrolls the page and sticks a
 * panel to the side, which is right for a stage with a rail beside it and
 * wrong here. These columns are peers — a list, the thing it selects, and what
 * was made of that thing — and each has to hold its place while another moves,
 * or choosing a Topic three pages down scrolls the document list away from
 * under the cursor.
 *
 * `min-height: 0` on the frame and every column is load-bearing: a grid item
 * defaults to `auto` and grows past its row instead of constraining what is
 * inside it, and `overflow: hidden` does not stop `scrollIntoView` from
 * scrolling an element that overflows. Below 900px the columns stack and the
 * page goes back to scrolling itself.
 *
 * Column heads and bodies stay with the feature: what belongs in a head
 * differs per column, and this owns only the geometry. */
export function Bench({ docs, children, extracted }: {
  docs: ReactNode;
  children: ReactNode;
  extracted: ReactNode;
}) {
  return (
    <div className="bench">
      <div className="col col--docs">{docs}</div>
      <div className="col col--doc">{children}</div>
      <div className="col col--out">{extracted}</div>
    </div>
  );
}
