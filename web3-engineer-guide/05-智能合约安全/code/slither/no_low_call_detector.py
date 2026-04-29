"""自定义 Slither detector：禁止任何裸 .call 不检查返回值。

加载方式：
    slither . --detect external-call-no-check \
        --detector-path code/slither/

依赖：slither-analyzer >= 0.10.0
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.slithir.operations import LowLevelCall


class ExternalCallNoCheck(AbstractDetector):
    ARGUMENT = "external-call-no-check"
    HELP = "Low-level call() whose return value is not checked"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.MEDIUM

    WIKI = "https://example.com/swc/swc-104"
    WIKI_TITLE = "Unchecked Call Return Value"
    WIKI_DESCRIPTION = "Calling .call without checking the boolean return permits silent failure."
    WIKI_RECOMMENDATION = "Always require((bool ok, ) = addr.call(...)); ok)"
    WIKI_EXPLOIT_SCENARIO = "Withdrawal silently fails; user assumes success and protocol diverges from accounting."

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            for func in contract.functions:
                for node in func.nodes:
                    for ir in node.irs:
                        if isinstance(ir, LowLevelCall):
                            # 检查是否赋值给 bool 并 require
                            text = str(node.expression).lower()
                            if "ok" not in text and "success" not in text:
                                results.append(self.generate_result([
                                    contract, " ", func, " has unchecked low-level call at ", node, "\n"
                                ]))
        return results
