if 'data_loader' not in globals():
    from mage_ai.data_preparation.decorators import data_loader
if 'test' not in globals():
    from mage_ai.data_preparation.decorators import test


@data_loader
def load_data(parameters, *args, **kwargs):
    """
    Reads the CSV file and returns the dataframe.

    It adds the columns "year_updated" and "quarter_updated".

    Returns:
        data frame
    """
    # Specify your data loading logic here

    data = {}

    return data


@test
def test_output(output, *args) -> None:
    """
    Template code for testing the output of the block.
    """
    assert output is not None, 'The output is undefined'
