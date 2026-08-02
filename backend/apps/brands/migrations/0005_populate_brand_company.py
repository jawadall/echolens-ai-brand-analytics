# Data migration: populate Brand.company from Brand.user.company_ref
from django.db import migrations


def populate_brand_company(apps, schema_editor):
    """Set each brand's company from its creator's company_ref"""
    Brand = apps.get_model('brands', 'Brand')
    for brand in Brand.objects.select_related('user').all():
        if brand.user and brand.user.company_ref_id:
            brand.company_id = brand.user.company_ref_id
            brand.save(update_fields=['company_id'])


def reverse_populate(apps, schema_editor):
    """Reverse: clear company field"""
    Brand = apps.get_model('brands', 'Brand')
    Brand.objects.all().update(company=None)


class Migration(migrations.Migration):
    dependencies = [
        ("brands", "0004_add_company_to_brand"),
    ]

    operations = [
        migrations.RunPython(populate_brand_company, reverse_populate),
    ]
