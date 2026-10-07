import type { PluginTheme } from "@getpaseo/plugin";
import { Modal, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { initialValues, missingFields, paramsFor } from "../shared/actions.js";
import type { Action, Call, Plan } from "../shared/rpc";
import { Button, ErrorMessage, Input, Label } from "./ui";

export function ActionDialog({ action, call, scopeKey, theme, close, refreshed }: {
  action: Action; call: Call; scopeKey: string; theme: PluginTheme; close: () => void; refreshed: () => void;
}) {
  const [values, setValues] = useState(initialValues(action));
  const toast = useToast();
  const params = paramsFor(action, values);
  const missing = missingFields(action, values);
  const plan = useQuery({ queryKey: [scopeKey, "plan", action.action, params],
    queryFn: () => call<Plan>({ op: "plan", action: action.action, params }),
    enabled: missing.length === 0, retry: false });
  const mutation = useMutation({ mutationFn: () => call<{ output: string; summary: string }>({ op: "action", action: action.action, params }),
    onSuccess(result) { toast.show(result.output || result.summary, { variant: "success" }); refreshed(); close(); },
    onError() { refreshed(); } });
  const update = (name: string, value: string | boolean) => {
    mutation.reset();
    setValues(previous => ({ ...previous, [name]: value }));
  };
  return <Modal title={action.title} open onOpenChange={open => { if (!open && !mutation.isPending) close(); }}>
    <Modal.Content>
      {action.note && <Label theme={theme}>{action.note}</Label>}
      {(action.fields ?? []).map(field => <View key={field.name} style={{ gap: 6 }}>
        <Label theme={theme}>{field.label}</Label>
        {field.type === "checkbox" ? <Button title={values[field.name] === true ? "✓ Enabled" : "Disabled"} theme={theme}
          disabled={mutation.isPending} onPress={() => update(field.name, values[field.name] !== true)} />
        : field.type === "select" ? <View style={{ gap: 4 }}>{field.options?.map(option => <Button key={option.value} theme={theme}
            title={option.label} active={values[field.name] === option.value} disabled={mutation.isPending}
            onPress={() => update(field.name, option.value)} />)}</View>
        : <Input value={String(values[field.name] ?? "")} onChangeText={value => { if (!mutation.isPending) update(field.name, value); }}
            placeholder={field.placeholder} theme={theme} multiline={field.name === "message"} />}
        {field.help && <Label theme={theme} muted>{field.help}</Label>}
      </View>)}
      {missing.length > 0 && <Label theme={theme}>Required: {missing.join(", ")}</Label>}
      <ErrorMessage error={plan.error ?? mutation.error} theme={theme} />
      {plan.data && missing.length === 0 && <View style={{ gap: 8 }}>
        <Label theme={theme} muted>Repository: {plan.data.root}</Label>
        <Label theme={theme}>{plan.data.plan.summary}</Label>
        {plan.data.plan.destructive && <Label theme={theme}>Destructive action — changes may be lost.</Label>}
        {plan.data.warnings.map((warning, index) => <Label key={index} theme={theme}>{warning}</Label>)}
        {plan.data.blocked && <Label theme={theme}>{plan.data.blocked}</Label>}
      </View>}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button theme={theme} title="Cancel" disabled={mutation.isPending} onPress={close} />
        <Button theme={theme} title={mutation.isPending ? "Running…" : "Confirm Git action"}
          disabled={missing.length > 0 || !plan.data || !!plan.data.blocked || plan.isFetching || !!plan.error || mutation.isPending}
          onPress={() => mutation.mutate()} />
      </View>
    </Modal.Content>
  </Modal>;
}

export function ActionsMenu({ title, actions, theme, close, select }: {
  title: string; actions: Action[]; theme: PluginTheme; close: () => void; select: (action: Action) => void;
}) {
  return <Modal title={title} open onOpenChange={open => { if (!open) close(); }}>
    <Modal.Content>{actions.length ? actions.map(action => <Button key={action.action} title={action.label} theme={theme}
      onPress={() => { close(); select(action); }} />) : <Label theme={theme} muted>No actions available.</Label>}</Modal.Content>
  </Modal>;
}
