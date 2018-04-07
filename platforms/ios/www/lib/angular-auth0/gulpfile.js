var gulp = require('gulp'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    ngAnnotate = require('gulp-ng-annotate'),
    sourceFiles = [
      'angular-auth0.js'
    ];

gulp.task('build', function() {
  gulp.src(sourceFiles)
    .pipe(concat('angular-auth0.js'))
    .pipe(ngAnnotate())
    .pipe(gulp.dest('./dist/'))
    .pipe(uglify())
    .pipe(rename('angular-auth0.min.js'))
    .pipe(gulp.dest('./dist'))
});

gulp.task('default', ['build']);