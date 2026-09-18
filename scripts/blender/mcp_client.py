"""Invoke the upstream Blender MCP tools over its real stdio MCP transport."""
import asyncio
import json
import os
import sys
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    params = StdioServerParameters(
        command='/Users/papazed/.local/bin/uvx', args=['blender-mcp==1.9.1'],
        env={**os.environ, 'DISABLE_TELEMETRY': 'true'},
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            if len(sys.argv) == 1:
                available = await session.list_tools()
                print('MCP tools:', ', '.join(t.name for t in available.tools))
                name, arguments = 'get_scene_info', {}
            else:
                name = 'execute_blender_code'
                arguments = {'code': Path(sys.argv[1]).read_text()}
            arguments['user_prompt'] = '请以此基模为核心拓扑，执行以下 4 项深化工程：'
            result = await session.call_tool(name, arguments)
            for item in result.content:
                if item.type == 'text':
                    print(item.text)
                    if item.text.startswith(('Error executing code:', 'Error getting scene info:', 'Rejected by safe mode')):
                        raise RuntimeError(item.text)
            if result.isError:
                raise SystemExit(1)

asyncio.run(main())
