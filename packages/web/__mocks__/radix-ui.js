// Mock for the 'radix-ui' bundled package.
// shadcn/ui components import each primitive as a namespace object with sub-components:
//   import { Label as LabelPrimitive } from "radix-ui"
//   <LabelPrimitive.Root .../>
// So each export must be an object containing all the sub-components it uses.
const React = require('react');

// Helper: create a simple forwardRef component that renders a native element
const el = (tag, displayName) => {
  const C = React.forwardRef(({ children, ...props }, ref) =>
    React.createElement(tag, { ...props, ref }, children),
  );
  C.displayName = displayName;
  return C;
};

// Helper: passthrough fragment wrapper (for Portal/Provider-style components)
const frag = (displayName) => {
  const C = ({ children }) => React.createElement(React.Fragment, null, children);
  C.displayName = displayName;
  return C;
};

// ─── Slot ────────────────────────────────────────────────────────────────────
// Used as <Slot> in button.tsx / badge.tsx and as <Slot.Root> in form.tsx
const SlotBase = React.forwardRef(({ children, ...props }, ref) => {
  if (React.isValidElement(children)) {
    // Child's own props take priority (matching real Radix Slot merge behavior)
    return React.cloneElement(children, { ...props, ...children.props, ref });
  }
  return React.createElement('span', { ...props, ref }, children);
});
SlotBase.displayName = 'Slot';

// Slot.Root is used by form.tsx: <Slot.Root .../>
// Merges accessibility props from Slot with the child's own props.
// Child props take priority, but accessibility attrs (aria-*, data-slot) from Slot are added.
const SlotRoot = React.forwardRef(({ children, ...slotProps }, ref) => {
  if (!React.isValidElement(children)) {
    return React.createElement('span', { ...slotProps, ref }, children);
  }
  // Just render children directly - don't clone, just pass through
  return children;
});
SlotRoot.displayName = 'Slot.Root';

// Export Slot as both a callable component AND an object with .Root
const Slot = Object.assign(SlotBase, { Root: SlotRoot });
Slot.displayName = 'Slot';

// ─── Label ───────────────────────────────────────────────────────────────────
// label.tsx: <LabelPrimitive.Root .../>
const LabelRoot = el('label', 'Label.Root');
const Label = { Root: LabelRoot };

// ─── Separator ───────────────────────────────────────────────────────────────
// separator.tsx: <SeparatorPrimitive.Root .../>
const SeparatorRoot = React.forwardRef(({ orientation = 'horizontal', ...props }, ref) =>
  React.createElement('hr', {
    role: 'separator',
    'aria-orientation': orientation,
    ...props,
    ref,
  }),
);
SeparatorRoot.displayName = 'Separator.Root';
const Separator = { Root: SeparatorRoot };

// ─── Switch ───────────────────────────────────────────────────────────────────
// switch.tsx: <SwitchPrimitive.Root ...> <SwitchPrimitive.Thumb .../>
const SwitchRoot = React.forwardRef(({ checked, onCheckedChange, children, ...props }, ref) =>
  React.createElement(
    'button',
    {
      role: 'switch',
      'aria-checked': checked,
      onClick: () => onCheckedChange?.(!checked),
      ...props,
      ref,
    },
    children,
  ),
);
SwitchRoot.displayName = 'Switch.Root';
const SwitchThumb = el('span', 'Switch.Thumb');
const Switch = { Root: SwitchRoot, Thumb: SwitchThumb };

// ─── Dialog ──────────────────────────────────────────────────────────────────
// dialog.tsx uses: Root, Trigger, Portal, Overlay, Content, Close, Title, Description
const DialogContext = React.createContext({ open: false, onOpenChange: () => {} });
const DialogRoot = ({ children, open, onOpenChange, defaultOpen }) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen || false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const handleChange = (v) => {
    if (!controlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  return React.createElement(
    DialogContext.Provider,
    { value: { open: isOpen, onOpenChange: handleChange } },
    children,
  );
};
DialogRoot.displayName = 'Dialog.Root';
const DialogTrigger = React.forwardRef(({ children, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext);
  return React.createElement('button', { onClick: () => onOpenChange(true), ...props, ref }, children);
});
DialogTrigger.displayName = 'Dialog.Trigger';
const DialogPortal = ({ children }) => {
  const { open } = React.useContext(DialogContext);
  if (!open) return null;
  return React.createElement(React.Fragment, null, children);
};
DialogPortal.displayName = 'Dialog.Portal';
const DialogOverlay = el('div', 'Dialog.Overlay');
const DialogContent = React.forwardRef(({ children, ...props }, ref) => {
  const { open } = React.useContext(DialogContext);
  if (!open) return null;
  return React.createElement('div', { role: 'dialog', ...props, ref }, children);
});
DialogContent.displayName = 'Dialog.Content';
const DialogClose = React.forwardRef(({ children, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext);
  return React.createElement('button', { onClick: () => onOpenChange(false), ...props, ref }, children);
});
DialogClose.displayName = 'Dialog.Close';
const DialogTitle = el('h2', 'Dialog.Title');
const DialogDescription = el('p', 'Dialog.Description');
const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Overlay: DialogOverlay,
  Content: DialogContent,
  Close: DialogClose,
  Title: DialogTitle,
  Description: DialogDescription,
};

// ─── Select ───────────────────────────────────────────────────────────────────
// select.tsx uses: Root, Group, Value, Trigger, Icon, Portal, Content, Viewport,
//                 Item, ItemText, ItemIndicator, Label, Separator,
//                 ScrollUpButton, ScrollDownButton
// We implement a context-based controlled mock so onValueChange is called on click.
const SelectContext = React.createContext({ value: undefined, onValueChange: undefined, open: false, setOpen: () => {} });

const SelectRoot = ({ children, value, onValueChange, defaultValue }) => {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;
  const handleChange = (v) => {
    if (!controlled) setInternalValue(v);
    onValueChange?.(v);
    setOpen(false);
  };
  return React.createElement(
    SelectContext.Provider,
    { value: { value: currentValue, onValueChange: handleChange, open, setOpen } },
    children,
  );
};
SelectRoot.displayName = 'Select.Root';
const SelectGroup = ({ children }) => React.createElement(React.Fragment, null, children);
SelectGroup.displayName = 'Select.Group';
const SelectValue = ({ placeholder }) => {
  const { value } = React.useContext(SelectContext);
  return React.createElement('span', null, value || placeholder);
};
SelectValue.displayName = 'Select.Value';
const SelectTrigger = React.forwardRef(({ children, ...props }, ref) => {
  const { setOpen, open } = React.useContext(SelectContext);
  return React.createElement(
    'button',
    { role: 'combobox', 'aria-expanded': open, onClick: () => setOpen((o) => !o), ...props, ref },
    children,
  );
});
SelectTrigger.displayName = 'Select.Trigger';
const SelectIcon = ({ children }) => React.createElement(React.Fragment, null, children);
SelectIcon.displayName = 'Select.Icon';
const SelectPortal = frag('Select.Portal');
const SelectContent = React.forwardRef(({ children, ...props }, ref) => {
  const { open } = React.useContext(SelectContext);
  if (!open) return null;
  return React.createElement('div', { role: 'listbox', ...props, ref }, children);
});
SelectContent.displayName = 'Select.Content';
const SelectViewport = el('div', 'Select.Viewport');
const SelectItem = React.forwardRef(({ children, value, ...props }, ref) => {
  const { onValueChange } = React.useContext(SelectContext);
  return React.createElement(
    'div',
    {
      role: 'option',
      'data-value': value,
      onClick: () => onValueChange?.(value),
      ...props,
      ref,
    },
    children,
  );
});
SelectItem.displayName = 'Select.Item';
const SelectItemText = ({ children }) => React.createElement('span', null, children);
SelectItemText.displayName = 'Select.ItemText';
const SelectItemIndicator = ({ children }) => React.createElement(React.Fragment, null, children);
SelectItemIndicator.displayName = 'Select.ItemIndicator';
const SelectLabel = el('span', 'Select.Label');
const SelectSeparator = el('hr', 'Select.Separator');
const SelectScrollUpButton = el('div', 'Select.ScrollUpButton');
const SelectScrollDownButton = el('div', 'Select.ScrollDownButton');
const Select = {
  Root: SelectRoot,
  Group: SelectGroup,
  Value: SelectValue,
  Trigger: SelectTrigger,
  Icon: SelectIcon,
  Portal: SelectPortal,
  Content: SelectContent,
  Viewport: SelectViewport,
  Item: SelectItem,
  ItemText: SelectItemText,
  ItemIndicator: SelectItemIndicator,
  Label: SelectLabel,
  Separator: SelectSeparator,
  ScrollUpButton: SelectScrollUpButton,
  ScrollDownButton: SelectScrollDownButton,
};

// ─── Tabs ────────────────────────────────────────────────────────────────────
// tabs.tsx uses: Root, List, Trigger, Content
const TabsRoot = React.forwardRef(({ children, ...props }, ref) =>
  React.createElement('div', { ...props, ref }, children),
);
TabsRoot.displayName = 'Tabs.Root';
const TabsList = React.forwardRef(({ children, ...props }, ref) =>
  React.createElement('div', { role: 'tablist', ...props, ref }, children),
);
TabsList.displayName = 'Tabs.List';
const TabsTrigger = React.forwardRef(({ children, value, ...props }, ref) =>
  React.createElement('button', { role: 'tab', 'data-value': value, ...props, ref }, children),
);
TabsTrigger.displayName = 'Tabs.Trigger';
const TabsContent = React.forwardRef(({ children, value, ...props }, ref) =>
  React.createElement('div', { role: 'tabpanel', 'data-value': value, ...props, ref }, children),
);
TabsContent.displayName = 'Tabs.Content';
const Tabs = { Root: TabsRoot, List: TabsList, Trigger: TabsTrigger, Content: TabsContent };

module.exports = {
  Slot,
  Label,
  Separator,
  Switch,
  Dialog,
  Select,
  Tabs,
};
