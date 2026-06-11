if 'transformer' not in globals():
    from mage_ai.data_preparation.decorators import transformer
if 'test' not in globals():
    from mage_ai.data_preparation.decorators import test


@transformer
def transform(data, *args, **kwargs):
    """
    -- Step 1.: Fix apartments with missing neighborhood codes (codi_barri and nom_barri)
    --          Based on analysis of similar entries on the same streets or geographic proximity
    -- Step 2.: Normalize coordinates for addresses with conflicting values
    --  Strategy: Use the coordinates from the first expedient (alphabetically) for each address
    --  This ensures consistency: same address = same coordinates
    --  Methodology: METHODOLOGY-coordinate-normalization.md

    Returns:
        data frame
    """
    # Specify your transformation logic here

    return data


@test
def test_output(output, *args) -> None:
    """
    Template code for testing the output of the block.
    """
    assert output is not None, 'The output is undefined'
