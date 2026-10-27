import { Handle, Position } from '@xyflow/react'

const HIDDEN = '!pointer-events-none !opacity-0'

export const LineageHandles = () => (
  <>
    <Handle type="target" position={Position.Left} isConnectable={false} className={HIDDEN} />
    <Handle type="source" position={Position.Right} isConnectable={false} className={HIDDEN} />
  </>
)
