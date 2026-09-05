import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaffSession } from "@/lib/staff-client";
import {
  deleteCategory,
  deleteMenuItem,
  saveCategory,
  saveMenuItem,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/owner/menu")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Menu Manager — Chiya" },
      { name: "description", content: "Add, edit and remove Chiya categories and menu items." },
      { property: "og:title", content: "Menu Manager — Chiya" },
      { property: "og:description", content: "Manage the Chiya menu." },
    ],
  }),
  component: MenuManager,
});

type ItemDraft = {
  id?: string;
  category_id: string;
  name: string;
  description: string;
  price: string;
  photo_url: string;
  is_available: boolean;
};

const emptyDraft = (category_id: string): ItemDraft => ({
  category_id,
  name: "",
  description: "",
  price: "",
  photo_url: "",
  is_available: true,
});

function MenuManager() {
  const { session } = useStaffSession("owner");
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState("");
  const [draft, setDraft] = useState<ItemDraft | null>(null);

  const menu = useQuery({
    queryKey: ["menu-admin"],
    queryFn: async () => {
      const [cats, items] = await Promise.all([
        supabase.from("menu_categories").select("*").order("sort_order"),
        supabase.from("menu_items").select("*").order("sort_order"),
      ]);
      if (cats.error) throw new Error(cats.error.message);
      if (items.error) throw new Error(items.error.message);
      return { categories: cats.data ?? [], items: items.data ?? [] };
    },
  });

  if (session === undefined) return null;
  if (!session) return <Navigate to="/staff" replace />;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["menu-admin"] });
  const guard = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <StaffShell session={session} title="Menu manager">
      <h1 className="mb-4 text-3xl">Menu manager</h1>

      <div className="card-surface mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1">
          <label className="text-sm font-medium" htmlFor="new-category">
            New category
          </label>
          <Input
            id="new-category"
            className="mt-1"
            placeholder="e.g. Cold Drinks"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
        </div>
        <Button
          disabled={!newCategory.trim()}
          onClick={() =>
            guard(async () => {
              await saveCategory({
                data: {
                  token: session.token,
                  name: newCategory,
                  sort_order: (menu.data?.categories.length ?? 0) + 1,
                },
              });
              setNewCategory("");
            }, "Category added")
          }
        >
          <Plus className="mr-1 size-4" /> Add category
        </Button>
      </div>

      <div className="space-y-6">
        {menu.data?.categories.map((cat) => (
          <section key={cat.id} className="card-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-2xl">{cat.name}</h2>
              <Button size="sm" variant="secondary" onClick={() => setDraft(emptyDraft(cat.id))}>
                <Plus className="mr-1 size-4" /> Add item
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const name = window.prompt("Rename category", cat.name);
                  if (name) void guard(() => saveCategory({ data: { token: session.token, id: cat.id, name } }), "Category renamed");
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(`Delete "${cat.name}" and all its items?`))
                    void guard(() => deleteCategory({ data: { token: session.token, id: cat.id } }), "Category deleted");
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>

            <div className="mt-3 space-y-2">
              {menu.data.items
                .filter((i) => i.category_id === cat.id)
                .map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                    {item.photo_url && (
                      <img src={item.photo_url} alt={item.name} loading="lazy" className="size-12 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <span className="font-semibold">Rs. {Number(item.price).toFixed(0)}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={item.is_available}
                        onCheckedChange={(checked) =>
                          guard(
                            () =>
                              saveMenuItem({
                                data: {
                                  token: session.token,
                                  id: item.id,
                                  category_id: item.category_id!,
                                  name: item.name,
                                  description: item.description ?? "",
                                  price: Number(item.price),
                                  photo_url: item.photo_url ?? "",
                                  is_available: checked,
                                },
                              }),
                            checked ? "Item available" : "Item hidden",
                          )
                        }
                      />
                      Available
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          id: item.id,
                          category_id: item.category_id!,
                          name: item.name,
                          description: item.description ?? "",
                          price: String(item.price),
                          photo_url: item.photo_url ?? "",
                          is_available: item.is_available,
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Delete "${item.name}"?`))
                          void guard(() => deleteMenuItem({ data: { token: session.token, id: item.id } }), "Item deleted");
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="card-surface w-full max-w-md p-5">
            <h2 className="text-2xl">{draft.id ? "Edit item" : "New item"}</h2>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Item name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Input
                placeholder="Short description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <Input
                placeholder="Price in Rs."
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
              <Input
                placeholder="Photo URL (optional)"
                value={draft.photo_url}
                onChange={(e) => setDraft({ ...draft, photo_url: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.is_available}
                  onCheckedChange={(checked) => setDraft({ ...draft, is_available: checked })}
                />
                Available for ordering
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button
                disabled={!draft.name.trim()}
                onClick={() =>
                  guard(async () => {
                    await saveMenuItem({
                      data: {
                        token: session.token,
                        id: draft.id,
                        category_id: draft.category_id,
                        name: draft.name,
                        description: draft.description,
                        price: Number(draft.price) || 0,
                        photo_url: draft.photo_url,
                        is_available: draft.is_available,
                      },
                    });
                    setDraft(null);
                  }, "Item saved")
                }
              >
                Save item
              </Button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
