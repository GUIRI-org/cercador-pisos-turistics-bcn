if 'data_loader' not in globals():
    from mage_ai.data_preparation.decorators import data_loader
if 'test' not in globals():
    from mage_ai.data_preparation.decorators import test


@data_loader
def load_data(*args, **kwargs):
    """
    Scrapes the URL 'https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic'
    to:
      - Get the year and quarter of the latest dataset available: Ex. "2026", "1T".
      - Gets the URL of the CSV file with the latest dataset available.
      - Downloads the CSV file to the data folder and adds the year and quarter to the filename


    Returns:
        A dataframe with the target folder + filename, the year, the quarter.
    """
    # Specify your data loading logic here
    filename = 'data/file.csv'
    year = '2026'
    quarter = '1T'
    return {}


@test
def test_output(output, *args) -> None:
    """
    Template code for testing the output of the block.
    """
    assert output is not None, 'The output is undefined'
