CREATE TABLE IF NOT EXISTS targets
(
    pk serial NOT NULL PRIMARY KEY,
    target_type integer NOT NULL,
    remote_id integer NOT NULL,
    md5 uuid,
    CONSTRAINT targets_target_type_remote_id_key UNIQUE (target_type, remote_id)
);

CREATE TABLE lessons
(
    pk serial NOT NULL PRIMARY KEY,
    target integer NOT NULL,
    summary character varying(512) NOT NULL,
    location character varying(512) NOT NULL,
    start_date timestamp without time zone NOT NULL
);

CREATE TABLE distant_classrooms
(
    pk serial NOT NULL PRIMARY KEY,
    target integer NOT NULL,
    lesson_a integer NOT NULL,
    lesson_b integer NOT NULL,
    start_date timestamp without time zone NOT NULL
);

CREATE TABLE large_gaps
(
    pk serial NOT NULL PRIMARY KEY,
    target integer NOT NULL,
    lesson_a integer NOT NULL,
    lesson_b integer NOT NULL,
    start_date timestamp without time zone NOT NULL
);

CREATE TABLE unbalanced_weeks
(
    pk serial NOT NULL PRIMARY KEY,
    target integer NOT NULL,
    start_date timestamp without time zone NOT NULL,
    lessons smallint[] NOT NULL
);