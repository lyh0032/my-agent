import { type StructuredToolInterface } from '@langchain/core/tools'
import { webSearchTool } from './webSearch'
import { drawImageTool } from './drawImage'

export const tools: StructuredToolInterface[] = [webSearchTool, drawImageTool]
