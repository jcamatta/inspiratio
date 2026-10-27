import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export const Disclosure = ({
  label,
  children,
  testId,
}: {
  readonly label: ReactNode
  readonly children: ReactNode
  readonly testId?: string
}) => (
  <BaseCollapsible.Root data-testid={testId}>
    <BaseCollapsible.Trigger
      className="group flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      data-testid={testId === undefined ? undefined : `${testId}-toggle`}
    >
      <ChevronRight size={12} className="transition group-data-[panel-open]:rotate-90" />
      {label}
    </BaseCollapsible.Trigger>
    <BaseCollapsible.Panel className="pt-2">{children}</BaseCollapsible.Panel>
  </BaseCollapsible.Root>
)
