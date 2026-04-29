# 一键安装依赖（pin 到具体 commit hash 或 tag）
install:
	forge install foundry-rs/forge-std@v1.9.5 --no-commit
	forge install OpenZeppelin/openzeppelin-contracts@v5.5.0 --no-commit
	forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v5.5.0 --no-commit
	forge install Vectorized/solady@v0.1.26 --no-commit

build:
	forge build

test:
	forge test -vv

test-fuzz:
	forge test --match-test testFuzz -vv

test-invariant:
	forge test --match-path "test/invariant/*" -vv

test-fork:
	forge test --match-path "test/fork/*" --fork-url $$MAINNET_RPC_URL -vv

coverage:
	forge coverage --report summary

storage:
	forge inspect MyToken storage-layout
	forge inspect MyTokenUUPS storage-layout

deploy-sepolia:
	forge script script/DeployScript.s.sol:DeployScript \
		--rpc-url $$SEPOLIA_RPC_URL \
		--private-key $$PRIVATE_KEY \
		--broadcast --verify -vvvv

anvil:
	anvil --host 0.0.0.0 --chain-id 31337

clean:
	forge clean
