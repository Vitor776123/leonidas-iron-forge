import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Item = { id: string };

/**
 * Lista reordenável por arrasto (funciona com toque e mouse).
 * O arrasto começa apenas pela alça (handle) para não conflitar com toques nos cards.
 */
export function SortableList<T extends Item>({
  items,
  onReorder,
  renderItem,
  className = "space-y-2",
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  renderItem: (item: T, handle: ReactNode, dragging: boolean) => ReactNode;
  className?: string;
}) {
  const [ordem, setOrdem] = useState<T[]>(items);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const estado = useRef<{ startY: number; ids: string[] } | null>(null);

  useEffect(() => {
    if (!arrastando) setOrdem(items);
  }, [items, arrastando]);

  function rects() {
    const el = containerRef.current;
    if (!el) return [] as { id: string; top: number; bottom: number }[];
    return Array.from(el.querySelectorAll<HTMLElement>("[data-sortable-id]")).map((n) => {
      const r = n.getBoundingClientRect();
      return { id: n.dataset["sortableId"]!, top: r.top, bottom: r.bottom };
    });
  }

  function iniciar(e: React.PointerEvent, id: string) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    estado.current = { startY: e.clientY, ids: ordem.map((i) => i.id) };
    setArrastando(id);
    setOffset(0);
  }

  function mover(e: React.PointerEvent) {
    if (!arrastando || !estado.current) return;
    const dy = e.clientY - estado.current.startY;
    setOffset(dy);

    const caixas = rects();
    const atual = caixas.findIndex((c) => c.id === arrastando);
    if (atual < 0) return;
    const y = e.clientY;
    let alvo = atual;
    for (let i = 0; i < caixas.length; i++) {
      if (i === atual) continue;
      const c = caixas[i]!;
      const meio = (c.top + c.bottom) / 2;
      if (i < atual && y < meio) {
        alvo = i;
        break;
      }
      if (i > atual && y > meio) alvo = i;
    }
    if (alvo !== atual) {
      const novo = [...ordem];
      const [it] = novo.splice(atual, 1);
      novo.splice(alvo, 0, it!);
      setOrdem(novo);
      estado.current.startY = e.clientY;
      setOffset(0);
    }
  }

  function soltar() {
    if (!arrastando) return;
    const antes = estado.current?.ids ?? [];
    const depois = ordem.map((i) => i.id);
    setArrastando(null);
    setOffset(0);
    estado.current = null;
    if (antes.length && depois.join(",") !== items.map((i) => i.id).join(",")) {
      onReorder(depois);
    }
  }

  return (
    <div ref={containerRef} className={className}>
      {ordem.map((item) => {
        const isDrag = arrastando === item.id;
        const handle = (
          <button
            type="button"
            aria-label="Arrastar para reordenar"
            onPointerDown={(e) => iniciar(e, item.id)}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center self-stretch text-muted-foreground active:cursor-grabbing active:text-primary"
          >
            <GripVertical className="size-5" />
          </button>
        );
        return (
          <div
            key={item.id}
            data-sortable-id={item.id}
            style={
              isDrag
                ? { transform: `translateY(${offset}px)`, zIndex: 30, position: "relative" }
                : undefined
            }
            className={isDrag ? "opacity-90 shadow-lg" : "transition-transform"}
          >
            {renderItem(item, handle, isDrag)}
          </div>
        );
      })}
    </div>
  );
}
