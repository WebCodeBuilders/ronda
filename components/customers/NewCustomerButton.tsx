"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Sheet, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";

export function NewCustomerButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [c, setC] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  async function save() {
    try {
      const r = await api<{ customer: { id: string } }>("/api/customers", { body: c });
      router.push(`/clientes/${r.customer.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}>Nuevo cliente</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nuevo cliente" maxWidth="max-w-md" footer={<Button fullWidth disabled={!c.name.trim()} onClick={save}>Guardar</Button>}>
        <div className="space-y-3">
          <Input label="Nombre" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
          <Input label="Teléfono" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
          <Input label="Email" type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
          <Input label="Dirección" value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} />
          <Textarea label="Notas (alergias, preferencias)" rows={2} value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} />
        </div>
      </Sheet>
    </>
  );
}
