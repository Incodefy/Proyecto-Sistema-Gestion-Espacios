from django.db import models

class Agenda(models.Model):
    idagenda = models.AutoField(db_column='idAgenda', primary_key=True)
    idmedico = models.ForeignKey('Medico', models.DO_NOTHING, db_column='idMedico', blank=True, null=True)
    idbox = models.ForeignKey('Box', models.DO_NOTHING, db_column='idBox', blank=True, null=True)
    idestado = models.ForeignKey('Estado', models.DO_NOTHING, db_column='idEstado', blank=True, null=True)
    horainicio = models.TimeField(db_column='horaInicio', blank=True, null=True)
    horafin = models.TimeField(db_column='horaFin', blank=True, null=True)
    fecha = models.DateField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'agenda'


class Box(models.Model):
    idbox = models.AutoField(db_column='idBox', primary_key=True)
    estado = models.IntegerField(blank=True, null=True)
    idpasillo = models.ForeignKey('Pasillo', models.DO_NOTHING, db_column='idPasillo', blank=True, null=True)
    nombre = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'box'

class Especialidad(models.Model):
    idespecialidad = models.AutoField(db_column='idEspecialidad', primary_key=True)
    nombre = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'especialidad'


class Estado(models.Model):
    idestado = models.AutoField(db_column='idEstado', primary_key=True)
    nombre = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'estado'

class Medico(models.Model):
    idmedico = models.AutoField(db_column='idMedico', primary_key=True)
    nombre = models.CharField(max_length=100, blank=True, null=True)
    idespecialidad = models.ForeignKey(Especialidad, models.DO_NOTHING, db_column='idEspecialidad', blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'medico'

class Pasillo(models.Model):
    idpasillo = models.AutoField(db_column='idPasillo', primary_key=True)
    nombre = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'pasillo'