import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function renderWithBreaks(node: React.ReactNode): React.ReactNode {
  if (typeof node === "string") {
    if (!/<br\s*\/?>/i.test(node)) return node;
    const parts = node.split(/<br\s*\/?>/gi);
    return parts.map((part, idx) => (
      <React.Fragment key={idx}>
        {idx > 0 && <br />}
        {part}
      </React.Fragment>
    ));
  }
  if (Array.isArray(node)) {
    return node.map((child, idx) => (
      <React.Fragment key={idx}>{renderWithBreaks(child)}</React.Fragment>
    ));
  }
  if (React.isValidElement(node) && (node.props as any)?.children) {
    return React.cloneElement(node, {
      ...(node.props as any),
      children: renderWithBreaks((node.props as any).children),
    });
  }
  return node;
}

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  // Normalize citations like 【chart】 to `📊 Chart` badge token
  const formattedContent = content.replace(/【chart】/gi, "`📊 Chart`");

  return (
    <div className={`space-y-2 text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children, ...props }) => (
            <h1
              className="mt-3 mb-1.5 text-base font-bold text-foreground border-b border-border/40 pb-1"
              {...props}
            >
              {renderWithBreaks(children)}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="mt-3 mb-1 text-sm font-bold text-foreground" {...props}>
              {renderWithBreaks(children)}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="mt-2.5 mb-1 text-sm font-semibold text-foreground" {...props}>
              {renderWithBreaks(children)}
            </h3>
          ),
          p: ({ children, ...props }) => (
            <p className="mb-2 last:mb-0 leading-relaxed text-foreground/90" {...props}>
              {renderWithBreaks(children)}
            </p>
          ),
          ul: ({ children, ...props }) => (
            <ul className="my-2 ml-4 list-disc space-y-1.5 text-foreground/90" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="my-2 ml-4 list-decimal space-y-1.5 text-foreground/90" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-relaxed pl-1 marker:text-primary" {...props}>
              {renderWithBreaks(children)}
            </li>
          ),
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-foreground" {...props}>
              {renderWithBreaks(children)}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em className="italic text-foreground/90" {...props}>
              {renderWithBreaks(children)}
            </em>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="my-2 rounded-r-md border-l-2 border-primary/70 bg-primary/5 py-1.5 pl-3 pr-2 italic text-muted-foreground"
              {...props}
            >
              {renderWithBreaks(children)}
            </blockquote>
          ),
          pre: ({ children, ...props }) => (
            <pre
              className="my-2 overflow-x-auto rounded-xl border border-border bg-card/90 p-3 font-mono text-xs text-foreground shadow-2xs"
              {...props}
            >
              {children}
            </pre>
          ),
          code: ({ className: codeClassName, children, ...props }: any) => {
            const textContent = String(children).trim();
            if (textContent === "📊 Chart") {
              return (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[11px] font-medium text-primary align-baseline shadow-xs">
                  📊 Chart
                </span>
              );
            }
            const isInline = !codeClassName?.includes("language-") && !String(children).includes("\n");
            if (isInline) {
              return (
                <code
                  className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-xs font-medium text-primary border border-border/40"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={codeClassName} {...props}>
                {children}
              </code>
            );
          },
          table: ({ children, ...props }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border/80 bg-card/70 shadow-2xs -mx-0.5 sm:mx-0">
              <table className="w-full min-w-[340px] border-collapse text-left text-xs" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-muted/80 border-b border-border/70" {...props}>
              {children}
            </thead>
          ),
          th: ({ children, ...props }) => (
            <th className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap text-left text-[11px] uppercase tracking-wider" {...props}>
              {renderWithBreaks(children)}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border-b border-border/30 px-3 py-2.5 text-foreground/90 align-top leading-relaxed text-xs break-words" {...props}>
              {renderWithBreaks(children)}
            </td>
          ),
          a: ({ children, ...props }) => (
            <a
              className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity font-medium"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
          hr: ({ ...props }) => (
            <hr className="my-3 border-border/50" {...props} />
          ),
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
}
