# 一键 deploy + verify, 隐藏所有 forge script 细节
# 验证日期: 2026-04
.PHONY: import-key deploy-sepolia deploy-base-sepolia deploy-mainnet verify-sepolia

# 1. 第一次设置: 把私钥导入 Foundry keystore (会要求两次输入密码)
import-key:
	cast wallet import deployer --interactive

# 2. 部署到 Sepolia
deploy-sepolia:
	forge script script/Deploy.s.sol:DeployScript \
		--rpc-url $${SEPOLIA_RPC_URL} \
		--account deployer \
		--sender $$(cast wallet address --account deployer) \
		--broadcast \
		--verify \
		--etherscan-api-key $${ETHERSCAN_API_KEY} \
		--slow \
		-vvvv

# 3. 部署到 Base Sepolia (Etherscan v2 unified key)
deploy-base-sepolia:
	forge script script/Deploy.s.sol:DeployScript \
		--rpc-url $${BASE_SEPOLIA_RPC_URL} \
		--account deployer \
		--sender $$(cast wallet address --account deployer) \
		--broadcast \
		--verify \
		--verifier blockscout \
		--verifier-url https://base-sepolia.blockscout.com/api/ \
		--slow \
		-vvvv

# 4. 部署到主网 (会确认两次)
deploy-mainnet:
	@echo "WARNING: deploying to MAINNET. Type yes to continue:"
	@read line; [ "$$line" = "yes" ]
	forge script script/Deploy.s.sol:DeployScript \
		--rpc-url $${MAINNET_RPC_URL} \
		--account deployer \
		--sender $$(cast wallet address --account deployer) \
		--broadcast \
		--verify \
		--etherscan-api-key $${ETHERSCAN_API_KEY} \
		--slow \
		-vvvv

# 5. 单独 verify (例: deploy 时 verify 失败需要重试)
verify-sepolia:
	forge verify-contract \
		--chain sepolia \
		--watch \
		--etherscan-api-key $${ETHERSCAN_API_KEY} \
		--constructor-args $$(cast abi-encode "constructor(string,string,uint256)" "Demo" "DMO" 1000000000000000000000000) \
		$${ADDRESS} src/Deploy.s.sol:MyToken
