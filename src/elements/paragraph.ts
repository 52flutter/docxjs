import { ContainerBase } from "./element-base";
import { ParagraphProperties } from "../dom/paragraph";
import { RenderContext } from "../dom/render-context";
import { appendClass } from "../utils";
import { element, children } from "../parser/xml-serialize";
import { Run } from "./run";
import { BookmarkStart, BookmarkEnd } from "./bookmark";

@element("p")
@children(BookmarkStart, BookmarkEnd) //Run
export class Paragraph extends ContainerBase {
    props: ParagraphProperties = {} as ParagraphProperties;

    render(ctx: RenderContext): Node {
        var elem = this.renderContainer(ctx, "p");

        if (this.props.numbering) {
            var numberingClass = ctx.numberingClass(this.props.numbering.id, this.props.numbering.level);
            elem.className = appendClass(elem.className, numberingClass);
        }

        return elem;
    }
}