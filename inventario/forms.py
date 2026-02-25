from django import forms
from .models import Producto, Responsable

class ProductoForm(forms.ModelForm):
    class Meta:
        model = Producto
        fields = '__all__'
        widgets = {
            'fecha_vencimiento': forms.DateInput(attrs={'type': 'date'}),
        }

class ResponsableForm(forms.ModelForm):
    class Meta:
        model = Responsable
        fields = ['nombre']