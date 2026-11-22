from chimerax.core.toolshed import BundleAPI


class _Q2DVFullAPI(BundleAPI):
    api_version = 1

    @staticmethod
    def start_tool(session, bi, ti):
        from .tool import Q2DVFullTool
        if ti.name == "Q2DV":
            return Q2DVFullTool(session, ti.name)
        raise ValueError("unknown Q2DV tool: %s" % ti.name)


bundle_api = _Q2DVFullAPI()
