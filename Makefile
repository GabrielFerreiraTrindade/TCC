.PHONY: install test mock-server generate-data train-model sam-build sam-deploy lint

install:
	python -m pip install -r requirements.txt

test:
	pytest -q

mock-server:
	python -m src.mocks.restconf_mock_server

generate-data:
	mkdir -p data
	python -m src.mocks.traffic_generator --out data/flows.csv --rows 20000

train-model: generate-data
	python -m src.module2_threats.train --data data/flows.csv --model-out data/model.joblib

sam-build:
	sam build -t infra/template.yaml

sam-deploy: sam-build
	sam deploy --guided -t infra/template.yaml
